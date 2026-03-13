# Gemini MCP Server

A powerful [Model Context Protocol](https://modelcontextprotocol.io/) server that integrates Google's Gemini models with Claude Code. Features **30+ AI tools** including image generation, batch processing, video generation, deep research, code execution, and more.

> Fork of [@rlabs-inc/gemini-mcp](https://github.com/RLabs-Inc/gemini-mcp) with added **batch image generation** support for 50% cost savings.

---

## What's New

### Batch Image Generation (50% Cost Savings)

Submit multiple image prompts as a single batch job using Gemini's Batch API. Images are generated asynchronously at **half the standard price**.

| Tool | Description |
|------|-------------|
| `gemini-batch-generate-images` | Submit 1-100 image prompts as a batch job |
| `gemini-check-batch` | Check job status and retrieve generated images |
| `gemini-list-batches` | List all batch jobs with their states |
| `gemini-cancel-batch` | Cancel a running batch job |

**Workflow:**
```
1. Submit batch  ->  gemini-batch-generate-images (array of prompts)
2. Wait          ->  Jobs process asynchronously (typically minutes to hours)
3. Check status  ->  gemini-check-batch (returns images when done)
```

### Updated Model Defaults

| Model | ID | Codename |
|-------|----|----------|
| Pro (text) | `gemini-3.1-pro-preview` | - |
| Flash (text) | `gemini-3-flash-preview` | - |
| Image (high quality) | `gemini-3-pro-image-preview` | NanoBananaPro |
| Image (fast/cheap) | `gemini-3.1-flash-image-preview` | NanoBanana2 |
| Video | `veo-2.0-generate-001` | - |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- A [Google AI Studio](https://aistudio.google.com/) API key

### Installation

```bash
git clone https://github.com/Borys520/gemini-mcp-server.git
cd gemini-mcp-server
npm install --ignore-scripts
npx tsc   # Build TypeScript
```

### Add to Claude Code

**Option A: Single server with NanoBananaPro (high quality images)**

```bash
claude mcp add gemini -s user -- node /path/to/gemini-mcp-server/dist/index.js
```

Then set the env var `GEMINI_API_KEY` in your config.

**Option B: Two servers - NanoBananaPro + NanoBanana2**

Edit `~/.claude.json` and add to `mcpServers`:

```json
{
  "gemini": {
    "command": "node",
    "args": ["/path/to/gemini-mcp-server/dist/index.js"],
    "env": {
      "GEMINI_API_KEY": "your-api-key",
      "GEMINI_PRO_MODEL": "gemini-3.1-pro-preview",
      "GEMINI_FLASH_MODEL": "gemini-3-flash-preview",
      "GEMINI_IMAGE_MODEL": "gemini-3-pro-image-preview"
    }
  },
  "gemini-nb2": {
    "command": "node",
    "args": ["/path/to/gemini-mcp-server/dist/index.js"],
    "env": {
      "GEMINI_API_KEY": "your-api-key",
      "GEMINI_IMAGE_MODEL": "gemini-3.1-flash-image-preview",
      "GEMINI_TOOL_PRESET": "image"
    }
  }
}
```

This gives you:
- `gemini` - Full toolset with NanoBananaPro for images
- `gemini-nb2` - Image-only toolset with NanoBanana2 (faster, cheaper, includes batch)

---

## All Tools (19 Groups, 37+ Tools)

### Text & Reasoning
| Tool | Description |
|------|-------------|
| `gemini-query` | Query Gemini Pro or Flash with configurable thinking levels |
| `gemini-brainstorm` | Creative brainstorming and ideation |
| `gemini-analyze-code` | Analyze code files for quality, bugs, and improvements |
| `gemini-analyze-text` | Analyze text content |
| `gemini-summarize` | Summarize long content |
| `gemini-structured` | Extract structured data (JSON) from text |
| `gemini-extract` | Extract specific information from content |

### Image Generation & Editing
| Tool | Description |
|------|-------------|
| `gemini-generate-image` | Generate images with NanoBananaPro (up to 4K, 10 aspect ratios) |
| `gemini-image-prompt` | Generate optimized prompts for image generation |
| `gemini-start-image-edit` | Start a multi-turn image editing session |
| `gemini-continue-image-edit` | Continue editing an image in a session |
| `gemini-end-image-edit` | End an image editing session |
| `gemini-list-image-sessions` | List active image editing sessions |
| `gemini-analyze-image` | Analyze and describe images |

### Batch Image Generation
| Tool | Description |
|------|-------------|
| `gemini-batch-generate-images` | Submit 1-100 prompts as a batch (50% cheaper) |
| `gemini-check-batch` | Check batch status and download results |
| `gemini-list-batches` | List all batch jobs |
| `gemini-cancel-batch` | Cancel a batch job |

### Video
| Tool | Description |
|------|-------------|
| `gemini-generate-video` | Generate videos with Veo 2.0 |
| `gemini-check-video` | Check video generation status |

### Research & Web
| Tool | Description |
|------|-------------|
| `gemini-search` | Google Search with AI-powered summarization |
| `gemini-deep-research` | Deep multi-step research on complex topics |
| `gemini-check-research` | Check deep research status |
| `gemini-research-followup` | Follow up on completed research |
| `gemini-analyze-url` | Analyze web page content |
| `gemini-compare-urls` | Compare content across URLs |
| `gemini-extract-from-url` | Extract specific data from URLs |

### Documents & Media
| Tool | Description |
|------|-------------|
| `gemini-analyze-document` | Analyze uploaded documents |
| `gemini-summarize-pdf` | Summarize PDF files |
| `gemini-extract-tables` | Extract tables from documents |
| `gemini-youtube` | Analyze YouTube videos |
| `gemini-youtube-summary` | Summarize YouTube videos |

### Code & Utilities
| Tool | Description |
|------|-------------|
| `gemini-run-code` | Execute code in a sandboxed environment |
| `gemini-speak` | Text-to-speech synthesis |
| `gemini-dialogue` | Multi-voice dialogue generation |
| `gemini-list-voices` | List available TTS voices |
| `gemini-count-tokens` | Count tokens for content |
| `gemini-create-cache` | Create content caches for repeated use |
| `gemini-query-cache` | Query cached content |
| `gemini-list-caches` | List active caches |
| `gemini-delete-cache` | Delete a cache |

---

## Tool Presets

Control which tools are loaded to reduce context usage:

| Preset | Tools Loaded |
|--------|-------------|
| `minimal` | query, brainstorm |
| `text` | query, brainstorm, analyze, summarize, structured |
| `image` | query, image-gen, image-edit, image-analyze, **batch-image-gen** |
| `research` | query, search, deep-research, url-context, document |
| `media` | query, image-gen, image-edit, image-analyze, **batch-image-gen**, video-gen, youtube, speech |
| `full` | All 19 groups (default) |

Set via `GEMINI_TOOL_PRESET` env var. Combine with `GEMINI_ENABLED_TOOLS` for fine-grained control.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *required* | Google AI Studio API key |
| `GEMINI_PRO_MODEL` | `gemini-3.1-pro-preview` | Model for pro/reasoning queries |
| `GEMINI_FLASH_MODEL` | `gemini-3-flash-preview` | Model for fast queries |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` | Model for image generation |
| `GEMINI_VIDEO_MODEL` | `veo-2.0-generate-001` | Model for video generation |
| `GEMINI_TOOL_PRESET` | `full` | Tool preset to load |
| `GEMINI_ENABLED_TOOLS` | - | Comma-separated tool groups (additive with preset) |
| `GEMINI_IMAGE_THINKING_LEVEL` | `high` | Default thinking level for images |
| `GEMINI_OUTPUT_DIR` | auto | Output directory for generated files |
| `VERBOSE` | `false` | Enable verbose logging |
| `QUIET` | `false` | Minimize logging |

---

## Batch Mode Pricing

Batch mode uses the Gemini Batch API at **50% of standard pricing**:

| Model | Standard | Batch (50% off) |
|-------|----------|-----------------|
| NanoBananaPro 1K-2K | $0.134/image | $0.067/image |
| NanoBananaPro 4K | $0.24/image | $0.12/image |
| NanoBanana2 0.5K | ~$0.045/image | ~$0.023/image |
| NanoBanana2 1K | ~$0.067/image | ~$0.034/image |

Jobs process asynchronously with a target turnaround of <24 hours (often much faster).

---

## Development

```bash
# Install dependencies
npm install --ignore-scripts

# Type check
npx tsc --noEmit

# Build
npx tsc

# Run locally
GEMINI_API_KEY=your-key node dist/index.js
```

---

## Credits

Based on [gemini-mcp](https://github.com/RLabs-Inc/gemini-mcp) by RLabs Inc. (MIT License).

## License

MIT
