# How to Merge the Latest Feature Branch into `main`

## 🚀 What's New in This PR?
- **Document-aware chat:** Users must select a file (PDF) to use as context for chat. Only content from the selected file is used for answers.
- **File selector in chat UI:** Users can only chat after selecting a file, making the experience precise and document-specific.
- **Qdrant file management:** File names are stored in Qdrant and can be listed via `/api/files`.
- **Frontend redesign:** Clean, modern, side-by-side layout with a settings modal for API key, improved chat and upload experience, and a beautiful background.

## How to Merge

### 1. Push your branch to the remote repository (if not already pushed):
```bash
git push origin <your-feature-branch>
```

### 2. Open a Pull Request (PR) on GitHub:
- Go to your repository on GitHub.
- Click "Compare & pull request" for your branch.
- Review the changes, add a description, and submit the PR.
- After review, click "Merge pull request" to merge into `main`.

### 3. Or, use GitHub CLI:
```bash
gh pr create --base main --head <your-feature-branch> --title "Document-aware chat, file selector, and frontend redesign" --body "This PR adds document-aware chat, a required file selector, Qdrant file management, and a modernized frontend."
# To merge after review:
gh pr merge --merge
```

---

**After merging, pull the latest changes to your local main:**
```bash
git checkout main
git pull origin main
```
