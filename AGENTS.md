# AGENT Guidelines for Subsonic-Run

This document outlines essential information for agents working on the `subsonic-run` codebase.

## Project Overview

`subsonic-run` is a TypeScript/Node.js application built with the Fastify web framework. It integrates with the Subsonic API to manage and play music. The front-end uses Nunjucks for templating and HTMX for dynamic content updates.

## Essential Commands

The following `npm` scripts are defined in `package.json`:

*   **`npm run dev`**: Starts the development server using `ts-node` for direct TypeScript execution.
    ```bash
    node --loader ts-node/esm src/index.ts
    ```
*   **`npm run build`**: Compiles the TypeScript code to JavaScript.
    ```bash
    tsc
    ```
*   **`npm run start`**: Starts the production server from the compiled JavaScript in `dist/`.
    ```bash
    node dist/index.js
    ```
*   **`npm test`**: Placeholder for running tests. Currently, it just echoes an error message.
    ```bash
    echo "Error: no test specified" && exit 1
    ```

## Code Organization and Structure

*   **`src/`**: Contains all TypeScript source files.
    *   **`src/index.ts`**: The main entry point of the Fastify application, responsible for server setup, plugin registration, and basic routes.
    *   **`src/music.ts`**: Defines routes related to music browsing (artists, albums, playlists, search) and media streaming (artwork, audio).
    *   **`src/run.ts`**: Defines routes for creating, viewing, and managing "runs" (custom music sessions).
    *   **`src/cache.ts`**: Contains caching logic for Subsonic API responses.
    *   **`src/processor.ts`**: Handles background processing logic for "runs."
    *   **`src/programs.ts`**: Logic for loading available programs.
    *   **`src/types.ts`**: TypeScript type definitions for the application.
    *   **`src/views/`**: Nunjucks template files (`.njk`).
*   **`data/`**: (Created at runtime) Stores JSON files representing saved "runs" (e.g., `run-1678886400000.json`).
*   **`output/`**: (Created at runtime) Stores processed audio files, served statically by the Fastify server.
*   **`dist/`**: (Created after `npm run build`) Contains the compiled JavaScript output.

## Naming Conventions and Style Patterns

*   TypeScript is used throughout the codebase.
*   Fastify is used for route definitions.
*   Nunjucks templates (`.njk`) are used for server-side rendering.
*   HTMX is used for partial page updates, often with `HX-Redirect` headers.
*   Camel case is generally used for variable and function names.
*   Imports use ES module syntax (e.g., `import ... from './module.js';`).

## Testing Approach and Patterns

*   The project currently has no defined testing framework or unit tests, as indicated by the placeholder `npm test` script.

## Important Gotchas or Non-Obvious Patterns

*   **Subsonic API Caching**: API responses are often cached using functions from `src/cache.ts` to improve performance and reduce API calls.
*   **Background Processing**: "Runs" are processed in the background using `processRun` from `src/processor.ts`. This operation is intentionally not `await`ed in the route handler, meaning the HTTP response is sent before the background task completes. Errors in background processing are logged but do not block the main request flow.
*   **HTMX Redirects**: Many POST requests return a `204 No Content` status with an `HX-Redirect` header, which HTMX interprets as a client-side redirect.
*   **Environment Variables**: Sensitive information like `SUBSONIC_URL`, `SUBSONIC_USER`, and `SUBSONIC_PASS` are loaded from environment variables (likely via a `.env` file, though not explicitly shown).
*   **Static File Serving**: The server serves static files from `node_modules/htmx.org/dist` at `/static/` and generated output files from the `output/` directory at `/output/`.

This document should help new agents quickly understand and contribute to the `subsonic-run` project.
