# MetaDataStringEditor

Browser-based editor for Unity IL2CPP `global-metadata.dat` files.

Upload, inspect, search, edit, and download modified metadata files — no local software installation required (except for self-hosting).

## Architecture

- **Frontend:** Next.js 14 + React + TypeScript + Tailwind CSS
- **Backend:** Python FastAPI (metadata parsing, editing, rebuilding)
- **Storage:** Server-side in-memory sessions (ephemeral)

## Project Structure

```
metadata-string-editor/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # FastAPI app with CORS
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── models/
│   │   └── metadata.py         # Pydantic data models
│   ├── services/
│   │   ├── parser.py           # Binary metadata parser
│   │   ├── editor.py           # String editing logic
│   │   └── builder.py          # Metadata file rebuilder
│   └── routes/
│       └── metadata_routes.py  # API endpoints
├── frontend/                   # Next.js frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   └── index.tsx           # Main SPA
│   ├── components/
│   │   ├── UploadZone.tsx      # Drag-and-drop file upload
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── MetadataInfo.tsx    # Metadata statistics viewer
│   │   ├── StringTable.tsx     # String list with inline edit
│   │   ├── SearchBar.tsx       # Text/regex search bar
│   │   ├── BulkReplace.tsx     # Bulk find-and-replace
│   │   ├── ActivityLog.tsx     # Modification history
│   │   └── ThemeToggle.tsx     # Dark/light mode toggle
│   ├── utils/
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── api.ts              # API client
│   └── styles/
│       └── globals.css         # Tailwind + CSS variables
└── deployment/
    ├── docker-compose.yml
    └── vercel.json
```

## Quick Start (Development)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload and parse a metadata file |
| GET | `/api/session/{id}` | Get session metadata |
| POST | `/api/edit/{id}` | Edit a single string |
| POST | `/api/bulk-replace/{id}` | Bulk find-and-replace |
| GET | `/api/history/{id}` | Get edit history |
| POST | `/api/undo/{id}` | Undo last edit |
| POST | `/api/export-project/{id}` | Export edits as JSON |
| POST | `/api/import-project/{id}` | Import edits from JSON |
| POST | `/api/download/{id}` | Download modified metadata |

## Deployment

### Docker (Linux VPS)

```bash
docker compose -f deployment/docker-compose.yml up -d
```

The app will be available at `http://your-server:3000`.

### Vercel

1. Deploy the backend separately (e.g., on a VPS or Railway).
2. Set `NEXT_PUBLIC_API_URL` to the backend URL in the frontend Vercel project.
3. Deploy the frontend directory as a Next.js project.

## How It Works

1. **Upload:** The binary `global-metadata.dat` is parsed server-side. The header is validated (`0xFAB11BAF` sanity check), and the string table is extracted.
2. **Edit:** Strings are edited via the web UI. Each edit is tracked in the session.
3. **Rebuild:** On download, the original file is modified in-place — the string table is rebuilt with the new values while preserving all other metadata structures.

## Supported Metadata Versions

- Unity IL2CPP metadata version 19+ (all modern Unity versions).
- Header sanity: `0xFAB11BAF`.
- Uses the standard `Il2CppGlobalMetadataHeader` structure with up to 52 fields.
