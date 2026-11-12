# Publication and deployment

The first GitHub publication targets the public repository `noeyah1230/3d-anatomy-quiz`. Review the exact files and history, then obtain the owner's approval before creating the repository and pushing its initial `main` branch. Use the approved Git ref so that private commit metadata stays local. Verify the repository's public visibility and confirm that its default branch resolves to the approved commit.

## Future GitHub milestones

1. Work from the published branch or a feature branch based on it. Use the existing project folder.
2. Run lint, typecheck, unit and integration tests, and the production build. Run the browser suite for rendering changes and check the anatomy coverage report for data changes.
3. Review the staged diff, then make a conventional commit for each tested milestone. Record the work and actual test results in the development log.
4. Obtain authorization before pushing. Verify the commit on GitHub after the push.

After publication, use GitHub's **Customize your pins** to add the repository to the portfolio profile. [GitHub contribution criteria](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)

## Future website deployment

When deployment is authorized, connect the GitHub repository through Cloudflare Pages Git integration. Use `main` as the production branch, `npm run build` as the build command, `dist` as the output directory, and Node 24. Keep feature branch preview deploys enabled. Cloudflare assigns the pages.dev URL after deployment. Verify the URL before adding it to the README. Label a partial hosted prototype **In development**. [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) · [Cloudflare React build settings](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
