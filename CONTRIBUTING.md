# Contributing to PaySphere

First off, thank you for considering contributing to PaySphere! It's people like you that make PaySphere such a great tool for small businesses.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be welcoming and respectful to all contributors.

## How to Contribute

### 1. Fork and Clone the Repository

1. Fork the repository to your own GitHub account.
2. Clone the project to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/paySphere.git
   cd paySphere
   ```

### 2. Set Up the Project Locally

PaySphere uses **pnpm** as its package manager. Before proceeding, make sure you install it globally:

```bash
npm install -g pnpm
```

PaySphere is divided into a Node.js/Express backend and a React (Vite) frontend.

#### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file in the `backend/` directory based on the following template:
   ```env
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_secret_key
   GOOGLE_CLIENT_ID=your_google_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   ```
4. Start the backend development server:

   ```bash
   pnpm run dev
   ```

   The backend API will run on `http://localhost:5000` (or the port specified in your code).

   The server seeds the RBAC roles and permissions automatically on boot, so no
   extra step is needed for a fresh database. If you change the role or
   permission definitions in `src/config/permissions.js`, re-seed by hand:

   ```bash
   pnpm run seed
   ```

   Seeding is idempotent — running it repeatedly is safe. It also assigns the
   default role to any account that does not yet have one.

#### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file in the `frontend/` directory based on the following template:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_GOOGLE_CLIENT_ID=your_google_id
   ```
4. Start the frontend development server:
   ```bash
   pnpm run dev
   ```
   The frontend will be accessible, typically at `http://localhost:5173`.

### 3. Making Changes

1. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes in the codebase.
3. Ensure that your code follows the existing style and conventions.
4. Test your changes locally to verify they work as expected.

#### Code Quality & Pre-commit Hooks

PaySphere enforces strict code quality standards using ESLint and Prettier. To prevent CI failures and maintain a clean commit history, we use **Husky** and **lint-staged** to automatically lint and format your code before every commit.

**Initial Setup (Required for all contributors):**
After cloning the repository and running `pnpm install`, you **must** run the following command once to set up the Git hooks:

```bash
pnpm run prepare
```

This command initializes Husky and installs the pre-commit hook in your local `.git/hooks` directory.

**How it works:**

- When you run `git commit`, Husky intercepts the commit process.
- `lint-staged` identifies only the files you have staged for commit.
- `eslint --fix` automatically fixes linting errors in JavaScript/JSX files.
- `prettier --write` formats all staged files according to the project's `.prettierrc` configuration.
- If any errors cannot be automatically fixed, the commit will be **blocked** until you manually resolve them.

**Manual Formatting:**
If you want to format the entire codebase manually, you can run:

```bash
pnpm run format
```

**Bypassing the Hook (Not Recommended):**
In extreme emergencies where you need to commit broken code (e.g., saving work in progress), you can bypass the hook using:

```bash
git commit -m "WIP: saving progress" --no-verify
```

_Note: Commits bypassed this way will likely fail CI checks and must be fixed before merging._

### 4. Submitting a Pull Request

1. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "Add some feature"
   ```
2. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a Pull Request from your fork to the main repository.
4. Provide a clear description of the changes you've made and reference any related issues.

## Finding Issues to Work On

Check out our issue tracker! We have issues labeled `good first issue` and `help wanted` which are perfect for new contributors.

Thank you for contributing!
