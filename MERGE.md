# How to Merge 'feature/ux-ui-improvements' into main

## Summary of Changes
- Transparent header that blends with the scenic background
- Unified background image and gradient for header and main content
- Wider upload box to prevent text wrapping
- Upload button always displays 'Upload' (except when uploading)
- Chat box title changed to "Chat with the Assistant"

## Merge via GitHub Pull Request
1. Push your branch if you haven't already:
   ```bash
   git push origin feature/ux-ui-improvements
   ```
2. Go to your repository on GitHub.
3. Click "Compare & pull request" for the `feature/ux-ui-improvements` branch.
4. Review the changes, add a description, and create the pull request.
5. After review, click "Merge pull request" to merge into `main`.

## Merge via GitHub CLI
1. Push your branch if you haven't already:
   ```bash
   git push origin feature/ux-ui-improvements
   ```
2. Create a pull request from the command line:
   ```bash
   gh pr create --base main --head feature/ux-ui-improvements --fill
   ```
3. Merge the pull request after review:
   ```bash
   gh pr merge --merge
   ```

---
After merging, pull the latest changes to your local `main` branch:
```bash
git checkout main
git pull origin main
```
