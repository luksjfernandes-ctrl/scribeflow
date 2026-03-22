<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/supabase-realtime-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/tiptap-editor-1a1a2e" alt="TipTap" />
  <img src="https://img.shields.io/badge/deploy-vercel-000?logo=vercel" alt="Vercel" />
</p>

# ✒️ ScribeFlow

**The open-source writing studio for novelists, screenwriters, and long-form creators.**

ScribeFlow is a free, browser-based alternative to [Scrivener 3](https://www.literatureandlatte.com/scrivener/overview) — built with React, TipTap, and Supabase. Organize your manuscript with a hierarchical binder, write in a distraction-free composition mode, manage characters and research, and export to PDF, DOCX, RTF, or plain text.

🔗 **[Try it live →](https://scribeflow-psi.vercel.app)**

---

## Why ScribeFlow?

Scrivener is the gold standard for fiction writing software — but it's paid, desktop-only, and closed-source. ScribeFlow brings the same core workflow to the browser, for free:

- **Binder** — Hierarchical document tree with drag-and-drop, colored folders, and structural templates (Manuscript, Characters, Places, Research, Trash)
- **Composition Mode** — OLED-dark immersive writing with paragraph dimming, typewriter scroll, and customizable typography
- **Cloud Sync** — Real-time persistence via Supabase with smart debounced autosave (no more lost work)
- **Multi-format Export** — Compile your manuscript to PDF, DOCX, RTF, or TXT with one click
- **Inspector** — Per-document metadata: synopsis, labels, status, notes, word count targets
- **Corkboard & Outliner** — Visual planning views for your story structure

---

## Screenshots

| Editor | Composition Mode |
|--------|-----------------|
| Full writing environment with binder, editor, and inspector | Distraction-free "Deep Dark" mode with paragraph focus |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Editor | TipTap (ProseMirror) |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Drag & Drop | dnd-kit |
| Export | jsPDF, docx-js |
| Animation | Motion (Framer Motion) |
| Validation | Zod |
| Deploy | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/luksjfernandes-ctrl/scribeflow.git
cd scribeflow
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema from `supabase_schema.sql`
3. Go to **Settings → API** and copy your **Project URL** and **anon public key**
4. Enable **Email/Password** auth in **Authentication → Providers**

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── components/
│   ├── Auth.tsx              # Login/signup
│   ├── Binder.tsx            # Hierarchical document tree
│   ├── Editor.tsx            # TipTap writing surface
│   ├── CompositionMode.tsx   # Immersive writing overlay
│   ├── CompositionSettings.tsx
│   ├── Inspector.tsx         # Document metadata panel
│   ├── Corkboard.tsx         # Visual card planning
│   ├── Outliner.tsx          # Tabular document view
│   ├── Scrivenings.tsx       # Combined text view
│   ├── MenuBar.tsx           # macOS-style menu bar
│   ├── ProjectsModal.tsx     # Project management
│   ├── SettingsModal.tsx     # Project settings
│   └── ExportModal.tsx       # Multi-format export
├── extensions/
│   └── paragraphFocus.ts     # TipTap paragraph dimming
├── hooks/
│   ├── useStructuralFolders.ts
│   └── useCompositionPrefs.ts
├── utils/
│   └── getDocIcon.tsx
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── types.ts
├── constants.ts
├── App.tsx                   # Main application
└── styles/
    └── composition.css
```

---

## Features

### Writing
- Rich text editor with formatting toolbar (bold, italic, underline, alignment)
- Multi-line titles and subtitle/epigraph field
- Smart autosave with 1.5s debounce — no keystroke lag
- Word and character count in real-time
- Zoom control

### Organization
- Project templates with 5 structural folders (Manuscript, Characters, Places, Research, Trash)
- Color-coded folders with 8-color picker
- Drag-and-drop reordering with grip handles
- Move documents between folders
- Functional trash with permanent delete and "Empty Trash"
- Structural folders protected from deletion

### Composition Mode
- OLED-black background (#0A0A0A) with warm text (#C8C8B0)
- Active paragraph highlighting (others dim to 25% opacity)
- Typewriter scroll (cursor stays centered)
- Floating settings panel: paper width, font size, font family, line height
- Preferences persist across sessions

### Export
- PDF with chapter separation
- DOCX with proper heading hierarchy
- RTF
- Plain text
- Compile only documents marked "Include in Compile"

### Infrastructure
- Supabase Auth (email/password)
- Row Level Security — users only see their own data
- Real-time sync with optimistic local updates
- Zod validation on all mutations
- Remembers last project on reload

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

---

## License

[MIT](LICENSE) — use it, fork it, build on it.

---

## Author

**Lucas Jonas Fernandes**
- GitHub: [@luksjfernandes-ctrl](https://github.com/luksjfernandes-ctrl)

---

<p align="center">
  <i>Built for writers who deserve better tools.</i>
</p>
