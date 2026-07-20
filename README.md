<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo_white.png">
  <img src="public/logo_dark.png" width="420" alt="AAS Studio" />
</picture>

**A modern web IDE for designing, versioning, and deploying Asset Administration Shells**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MUI](https://img.shields.io/badge/MUI-7-007FFF?logo=mui&logoColor=white)](https://mui.com)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![IDTA](https://img.shields.io/badge/IDTA-01002--3--0-10b981)](https://industrialdigitaltwin.org)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

</div>

---

## What is an Asset Administration Shell?

The **Asset Administration Shell (AAS)** is the standardized digital representation of an asset — a machine, component, or system — defined by the [Industrial Digital Twin Association (IDTA)](https://industrialdigitaltwin.org). It acts as the passport of a physical or digital asset inside an Industry 4.0 ecosystem, carrying all its data, structure, and semantics in a machine-readable, interoperable format.

AAS Studio is a purpose-built front-end for creating and managing AAS models without writing a single line of JSON or AASX by hand.

---

## Architecture

AAS Studio is a **three-module platform** — this repository contains the frontend only. To run it properly you also need the two companion modules:

| Module | Role | Default port |
|---|---|---|
| **aas-studio-react** (this repo) | Web IDE — editor, lifecycle, gateway, server generator | `5173` (dev) |
| **[aas-studio-api](https://github.com/eng-identikit/aas-studio-api/blob/main/README.md)** | REST backend — JWT authentication, sessions, git-like AAS versioning on MariaDB, IDTA template catalog, proxy to the runner | `9010` |
| **[aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md)** | Python microservice that instantiates on-demand, IDTA-compliant **debug AAS servers** from the UI | `6790` (control) · `6789` (debug server) |

- **`aas-studio-api` is required to run the frontend.** Sign-in, sessions, and every editor/lifecycle operation go through its REST API (`VITE_API_URL`, default `http://localhost:9010/api`). Without it, the frontend cannot get past the login page.
- **`aas-server-runner` is required to instantiate AAS servers from the interface** — the "Run Server" feature of the Server section. The frontend calls `/v1/runner/*` on the API, which proxies the runner's control API to spawn a live AAS server (port `6789`) loaded with the current model. All other sections work without it.

---

## Features

### 🛠 AAS Editor
Design the full structure of an Asset Administration Shell interactively:
- Create and configure AAS instances or type assets
- Add **Submodels** with typed elements — `Property`, `MultiLanguageProperty`, `SubmodelElementCollection`, `Operation`, `File`, `Blob`, `ReferenceElement`
- Assign XSD value types (`xs:string`, `xs:int`, `xs:date`, `xs:anyURI`, …)
- Switch between **List view** (edit mode) and **Graph view** (visual tree of the AAS → Submodels → Elements hierarchy)
- One-click **IDTA-01002-3-0 validation** with a structured error report
- Export the shell as a ready-to-use artifact

### 🔄 AAS Lifecycle
Track the full version history of every AAS model:
- Version timeline with expandable **changelogs** (`added` / `modified` / `removed`)
- Status badges: `Draft` → `Active` → `Deprecated`
- Author attribution and ISO date tracking per version revision
- Export the full changelog for audit trails

### ⚡ AAS Server Generator
Generate a **production-ready FastAPI server** from your AAS model in seconds:
- Auto-generates `main.py`, `models.py`, `Dockerfile`, and `docker-compose.yml`
- Fully IDTA-01002-3-0 compliant REST API with OpenAPI spec
- Pydantic schemas, route handlers, and health-check endpoint included
- Real-time generation progress log
- Copy to clipboard or download individual files

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.7 |
| UI | Material UI 7 + MUI X (Charts, DataGrid, DatePickers, TreeView) |
| Routing | React Router DOM 7 |
| Build | Vite 6 |
| i18n | i18next + react-i18next (🇮🇹 / 🇬🇧) |
| HTTP | Axios |
| Realtime | Socket.IO Client |
| Notifications | notistack |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- **[aas-studio-api](https://github.com/eng-identikit/aas-studio-api/blob/main/README.md) up and running** on `http://localhost:9010` (needs MariaDB + Redis) — required
- [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md) on `http://localhost:6790` — required only for the "Run Server" feature

### Installation

```bash
git clone https://github.com/Engineering-Research-and-Development/aas-studio.git
cd aas-studio
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── api/              # Axios wrapper & API manager
├── context/          # React contexts (AAS, Session, Dialog, Notifications…)
├── i18n/             # Translations (it / en)
├── models/           # TypeScript interfaces (Operator, Session…)
├── pages/
│   ├── public/       # Sign-in page
│   └── secure/
│       ├── AASEditor/     # Shell designer + graph view
│       ├── AASGateway/    # Connect to live AAS servers (debug or remote)
│       ├── AASLifecycle/  # Version timeline
│       ├── AASServer/     # Server code generator + Run Server (via aas-server-runner)
│       ├── Dashboard/     # Overview & quick actions
│       └── Main/          # App shell (sidebar, header, theme)
├── routes/           # Protected routes & router
├── theme/            # MUI theme primitives & customizations
└── utils/            # Helpers (formatting, colors…)
```

---

## Standards Compliance

AAS Studio targets **IDTA-01002-3-0** — the Asset Administration Shell Metamodel specification published by the Industrial Digital Twin Association. Generated servers and exported models are validated against this specification.

- [IDTA Specification Part 2 — Metamodel](https://industrialdigitaltwin.org/content-hub/aasspecifications)
- [AAS Schemas Repository](https://github.com/admin-shell-io/aas-specs)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for more information.

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/Engineering-Research-and-Development">Engineering Ingegneria Informatica</a>
</div>


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
