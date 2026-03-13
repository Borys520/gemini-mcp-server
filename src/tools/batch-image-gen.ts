/**
 * Batch Image Generation Tool - Generate multiple images at 50% cost using Gemini Batch API
 *
 * Submits batch jobs for asynchronous image generation. Results are polled
 * and retrieved when ready. Ideal for bulk generation where real-time
 * response is not needed.
 *
 * Batch API pricing: 50% of standard per-image cost.
 * Target turnaround: ~24 hours (often much faster).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { genAI, getOutputDir } from '../gemini-client.js'
import { Modality } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

// Store active batch jobs for status checking
const activeBatchJobs = new Map<string, { prompts: string[]; model: string }>()

/**
 * Register batch image generation tools with the MCP server
 */
export function registerBatchImageGenTool(server: McpServer): void {
  // Submit a batch of image generation requests
  server.tool(
    'gemini-batch-generate-images',
    {
      prompts: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe('Array of image descriptions to generate (1-100 prompts)'),
      style: z
        .string()
        .optional()
        .describe('Art style applied to all images (e.g., "photorealistic", "watercolor", "anime")'),
      aspectRatio: z
        .enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
        .default('1:1')
        .describe('Aspect ratio for all images'),
      imageSize: z
        .enum(['1K', '2K', '4K'])
        .default('2K')
        .describe('Resolution for all images: 1K (fast), 2K (balanced), 4K (highest quality)'),
      displayName: z
        .string()
        .optional()
        .describe('Optional name for this batch job (for tracking)'),
    },
    async ({ prompts, style, aspectRatio, imageSize, displayName }) => {
      logger.info(`Submitting batch image generation: ${prompts.length} images`)

      try {
        const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'

        // Build inlined requests for batch API
        const inlinedRequests = prompts.map((prompt) => {
          const fullPrompt = style ? `${prompt}, in ${style} style` : prompt
          return {
            contents: [{ role: 'user' as const, parts: [{ text: fullPrompt }] }],
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
              imageConfig: {
                aspectRatio,
                imageSize,
              },
            },
          }
        })

        // Submit batch job
        const batchJob = await genAI.batches.create({
          model: imageModel,
          src: inlinedRequests,
          config: {
            displayName: displayName || `batch-images-${Date.now()}`,
          },
        })

        const jobName = batchJob.name || `batch-${Date.now()}`

        // Store job metadata for later retrieval
        activeBatchJobs.set(jobName, {
          prompts,
          model: imageModel,
        })

        logger.info(`Batch job created: ${jobName}, state: ${batchJob.state}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Batch image generation job submitted successfully!\n\n` +
                `Job name: ${jobName}\n` +
                `State: ${batchJob.state}\n` +
                `Images requested: ${prompts.length}\n` +
                `Model: ${imageModel}\n` +
                `Settings: ${imageSize}, ${aspectRatio}${style ? `, style: ${style}` : ''}\n` +
                `Created: ${batchJob.createTime || 'now'}\n\n` +
                `Use gemini-check-batch with this job name to check status and retrieve results.\n` +
                `Batch mode saves 50% on generation costs. Target turnaround: <24 hours.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error submitting batch job: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error submitting batch image generation: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Check batch job status and retrieve results
  server.tool(
    'gemini-check-batch',
    {
      jobName: z.string().describe('The batch job name returned by gemini-batch-generate-images'),
    },
    async ({ jobName }) => {
      logger.info(`Checking batch job status: ${jobName}`)

      try {
        const batchJob = await genAI.batches.get({ name: jobName })
        const state = batchJob.state || 'UNKNOWN'

        logger.info(`Batch job ${jobName} state: ${state}`)

        // If not completed, return status update
        if (state !== 'JOB_STATE_SUCCEEDED') {
          let statusMessage = `Batch job status: ${state}\n` +
            `Job: ${jobName}\n` +
            `Created: ${batchJob.createTime || 'unknown'}\n` +
            `Updated: ${batchJob.updateTime || 'unknown'}`

          if (state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
            statusMessage += `\n\nError: ${batchJob.error ? JSON.stringify(batchJob.error) : 'Unknown error'}`
          } else {
            statusMessage += '\n\nJob is still processing. Check again later.'
          }

          return {
            content: [{ type: 'text' as const, text: statusMessage }],
            isError: state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED',
          }
        }

        // Job succeeded - extract and save images
        const responses = batchJob.dest?.inlinedResponses || []
        const jobMeta = activeBatchJobs.get(jobName)
        const savedImages: string[] = []
        const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = []

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i]

          if (response.error) {
            content.push({
              type: 'text' as const,
              text: `Image ${i + 1}: Error - ${JSON.stringify(response.error)}`,
            })
            continue
          }

          const parts = response.response?.candidates?.[0]?.content?.parts
          if (!parts) {
            content.push({
              type: 'text' as const,
              text: `Image ${i + 1}: No content in response`,
            })
            continue
          }

          let imageData: string | undefined
          let mimeType = 'image/png'
          let description: string | undefined

          for (const part of parts) {
            if (part.inlineData) {
              imageData = part.inlineData.data
              mimeType = part.inlineData.mimeType || 'image/png'
            } else if (part.text) {
              description = part.text
            }
          }

          if (imageData) {
            // Save image to disk
            const timestamp = Date.now()
            const extension = mimeType.split('/')[1] || 'png'
            const filename = `batch-${timestamp}-${i + 1}.${extension}`
            const filePath = path.join(getOutputDir(), filename)

            const buffer = Buffer.from(imageData, 'base64')
            fs.writeFileSync(filePath, buffer)
            savedImages.push(filePath)

            // Add image to response so Claude can see it
            content.push({
              type: 'image' as const,
              data: imageData,
              mimeType,
            })

            const promptLabel = jobMeta?.prompts[i] ? ` "${jobMeta.prompts[i].substring(0, 50)}..."` : ''
            content.push({
              type: 'text' as const,
              text: `Image ${i + 1}${promptLabel}: Saved to ${filePath}${description ? ` - ${description}` : ''}`,
            })
          }
        }

        // Summary
        content.push({
          type: 'text' as const,
          text: `\nBatch complete! ${savedImages.length}/${responses.length} images generated and saved.\n` +
            `Output directory: ${getOutputDir()}`,
        })

        // Clean up stored metadata
        activeBatchJobs.delete(jobName)

        return { content }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error checking batch job: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error checking batch job: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // List all batch jobs
  server.tool(
    'gemini-list-batches',
    {
      limit: z
        .number()
        .default(10)
        .describe('Maximum number of batch jobs to list (default 10)'),
    },
    async ({ limit }) => {
      logger.info(`Listing batch jobs (limit: ${limit})`)

      try {
        const batchJobs = await genAI.batches.list({ config: { pageSize: limit } })

        const jobs: string[] = []
        for await (const job of batchJobs) {
          jobs.push(
            `- ${job.name}\n` +
            `  Display: ${job.displayName || 'unnamed'}\n` +
            `  State: ${job.state}\n` +
            `  Model: ${job.model || 'unknown'}\n` +
            `  Created: ${job.createTime || 'unknown'}\n` +
            `  Updated: ${job.updateTime || 'unknown'}`
          )
          if (jobs.length >= limit) break
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: jobs.length > 0
                ? `Batch jobs (${jobs.length}):\n\n${jobs.join('\n\n')}`
                : 'No batch jobs found.',
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error listing batch jobs: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing batch jobs: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Cancel a batch job
  server.tool(
    'gemini-cancel-batch',
    {
      jobName: z.string().describe('The batch job name to cancel'),
    },
    async ({ jobName }) => {
      logger.info(`Cancelling batch job: ${jobName}`)

      try {
        await genAI.batches.cancel({ name: jobName })
        activeBatchJobs.delete(jobName)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Batch job ${jobName} has been cancelled.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error cancelling batch job: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error cancelling batch job: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
