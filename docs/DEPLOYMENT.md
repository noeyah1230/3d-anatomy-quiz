# Deployment plan

Publishing is pending the owner's authorization, account access, and application license choice. The existing local repository uses `main`.

After choosing a license and reviewing the files, the owner can run these commands from the project root. Replace the author placeholders with the desired GitHub-verified name and email or GitHub-provided noreply address.

```sh
git config user.name "YOUR DISPLAY NAME"
git config user.email "YOUR VERIFIED OR NOREPLY EMAIL"
git add .
git diff --cached --stat
git commit -m "feat: add initial 3D anatomy viewer"
gh auth login
git_account="$(gh api user --jq .login)"
gh repo create "$git_account/anatomy-quiz" --public --source=. --remote=origin --push
```

Use Git integration when ready to connect Cloudflare Pages. Choose this repository and the `main` production branch, build command `npm run build`, output directory `dist`, and Node 24. Keep feature-branch preview deploys enabled. Cloudflare assigns the pages.dev URL after deployment. Verify it before adding it to the README. Label any partial hosted prototype **In development**. [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) · [Cloudflare React build settings](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)

Once the repository is public, open the GitHub profile, choose **Customize your pins**, and select this repository. [GitHub contribution criteria](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)
