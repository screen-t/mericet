# Mericet - Development Workflow and Git Strategy

## Git Branching Strategy

### Branch Types and Naming Conventions

We follow a **Git Flow** branching model with the following branch types:

#### 1. Main Branches (Permanent)

**`main`** (Production Branch)
- Always contains production-ready code
- Protected branch - no direct commits
- All merges require PR approval
- Auto-deploys to production
- Tagged with version numbers (v1.0.0, v1.1.0, etc.)

**`develop`** (Development Branch)
- Integration branch for features
- Contains latest completed features
- Protected branch - no direct commits
- All merges require PR review
- Auto-deploys to staging environment

#### 2. Supporting Branches (Temporary)

**Feature Branches:** `feature/<ticket-id>-<short-description>`
- Created from: `develop`
- Merged back into: `develop`
- Naming examples:
  - `feature/MRC-123-user-authentication`
  - `feature/MRC-124-post-creation-modal`
  - `feature/MRC-125-message-notifications`

**Bugfix Branches:** `bugfix/<ticket-id>-<short-description>`
- Created from: `develop`
- Merged back into: `develop`
- Naming examples:
  - `bugfix/MRC-234-fix-login-error`
  - `bugfix/MRC-235-profile-image-upload`

**Hotfix Branches:** `hotfix/<version>-<short-description>`
- Created from: `main`
- Merged back into: `main` AND `develop`
- Naming examples:
  - `hotfix/v1.0.1-security-patch`
  - `hotfix/v1.0.2-critical-login-fix`

**Release Branches:** `release/<version>`
- Created from: `develop`
- Merged back into: `main` AND `develop`
- Naming examples:
  - `release/v1.0.0`
  - `release/v1.1.0`

### Branch Protection Rules

**`main` branch:**
- Require pull request reviews (minimum 2 approvals)
- Require status checks to pass (CI/CD)
- Require branches to be up to date before merging
- Require signed commits
- Restrict who can push (only Tech Lead and DevOps)
- No force pushes allowed
- No deletions allowed

**`develop` branch:**
- Require pull request reviews (minimum 1 approval)
- Require status checks to pass (CI/CD)
- Require branches to be up to date before merging
- Team Leads can push directly in emergencies
- No force pushes allowed
- No deletions allowed

## Development Workflow

### 1. Starting New Work

```bash
# Step 1: Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# Step 2: Create a new feature branch
git checkout -b feature/MRC-123-user-authentication

# Step 3: Start coding
# Make your changes...
```

### 2. Committing Changes

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements

**Examples:**

```bash
git commit -m "feat(auth): implement email login functionality

- Add login form with validation
- Integrate with Supabase auth
- Add error handling for invalid credentials
- Add loading states

Resolves: MRC-123"
```

```bash
git commit -m "fix(profile): resolve avatar upload issue

- Fix file size validation
- Add proper error messages
- Update upload progress indicator

Fixes: MRC-234"
```

### 3. Pushing Changes

```bash
# Push your feature branch to remote
git push origin feature/MRC-123-user-authentication

# For first push of new branch
git push -u origin feature/MRC-123-user-authentication
```

### 4. Creating Pull Request

**PR Title Format:**
```
[MRC-123] Add user authentication functionality
```

**PR Description Template:**

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123
Related to #124

## Changes Made
- List of key changes
- Another change
- And another

## Screenshots (if applicable)
[Add screenshots here]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Test Cases
1. Describe test case 1
2. Describe test case 2

## Checklist
- [ ] Code follows project coding standards
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.log or debugging code
- [ ] Tests pass locally
- [ ] No new warnings or errors
- [ ] Backward compatible

## Reviewer Notes
Any specific areas you want reviewers to focus on
```

### 5. Code Review Process

**For Reviewers:**

1. **Review within 24 hours** of PR creation
2. **Check for:**
   - Code correctness and logic
   - Adherence to coding standards
   - Test coverage
   - Performance implications
   - Security concerns
   - Documentation completeness

3. **Provide feedback:**
   - Use "Request Changes" for blocking issues
   - Use "Comment" for suggestions
   - Use "Approve" when ready to merge

4. **Review comments should be:**
   - Constructive and specific
   - Include code suggestions when possible
   - Explain the "why" behind feedback

**For PR Authors:**

1. **Respond to all comments**
2. **Make requested changes**
3. **Re-request review** after changes
4. **Don't merge until approved**

### 6. Merging Pull Requests

**Requirements before merge:**
- All required approvals received
- All CI/CD checks pass
- No merge conflicts
- Branch is up to date with base branch

**Merge Strategy:**
- Use "Squash and Merge" for feature branches
- Use "Merge Commit" for release branches
- Use "Rebase and Merge" for hotfixes

```bash
# After PR approval, merge using GitHub UI or:
git checkout develop
git merge --no-ff feature/MRC-123-user-authentication
git push origin develop

# Delete feature branch after merge
git branch -d feature/MRC-123-user-authentication
git push origin --delete feature/MRC-123-user-authentication
```

## Code Review Guidelines

### What to Review

**Functionality:**
- Does the code do what it's supposed to do?
- Are edge cases handled?
- Are error conditions handled properly?

**Code Quality:**
- Is the code readable and maintainable?
- Is the code DRY (Don't Repeat Yourself)?
- Are functions/components properly sized?
- Are naming conventions followed?

**Performance:**
- Are there any obvious performance issues?
- Is the code efficient?
- Are expensive operations cached?

**Security:**
- Are there any security vulnerabilities?
- Is user input validated?
- Are authentication/authorization checks in place?

**Testing:**
- Are there appropriate tests?
- Do tests cover edge cases?
- Are tests meaningful and not just for coverage?

**Documentation:**
- Are complex sections documented?
- Are API changes documented?
- Are breaking changes noted?

### Review Response Time SLA

- **Critical/Hotfix PRs:** Within 2 hours
- **High Priority PRs:** Within 4 hours
- **Normal PRs:** Within 24 hours
- **Low Priority/Docs PRs:** Within 48 hours

### Review Approval Requirements

| Branch Type | Required Approvals | Who Can Approve |
|-------------|-------------------|-----------------|
| feature/* -> develop | 1 | Team Lead or Senior Dev |
| bugfix/* -> develop | 1 | Team Lead or Senior Dev |
| release/* -> main | 2 | Technical Lead + QA Lead |
| hotfix/* -> main | 2 | Technical Lead + Backend Lead |

## Continuous Integration / Continuous Deployment (CI/CD)

### Automated Checks on Every PR

**Frontend:**
```yaml
- Lint check (ESLint)
- Type check (TypeScript)
- Unit tests (Vitest)
- Build test
- Bundle size check
```

**Backend:**
```yaml
- Lint check
- Unit tests
- Integration tests
- API contract validation
- Security scan
```

**Database:**
```yaml
- Migration validation
- Schema lint
- RLS policy check
```

### Deployment Pipeline

**On Push to `develop`:**
- Run all tests
- Build application
- Deploy to staging environment
- Run smoke tests
- Notify team in Slack

**On Merge to `main`:**
- Run all tests
- Build application
- Deploy to production
- Run smoke tests
- Create release tag
- Generate release notes
- Notify team in Slack

## Repository Structure

```
Mericet/
├── .github/
│   ├── workflows/          # GitHub Actions CI/CD
│   │   ├── frontend-ci.yml
│   │   ├── backend-ci.yml
│   │   └── deploy.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       ├── feature_request.md
│       └── task.md
├── frontend/               # Frontend code (Team: Frontend)
│   ├── src/
│   ├── tests/
│   └── package.json
├── supabase/              # Database & Backend (Team: Backend/DB)
│   ├── migrations/
│   ├── functions/
│   └── config.toml
├── docs/                  # Documentation (Team: All)
│   ├── api/
│   ├── database/
│   └── guides/
├── scripts/               # Utility scripts (Team: DevOps)
│   ├── deploy.sh
│   └── backup.sh
└── README.md
```

### Team Access and Responsibilities

**Frontend Team:**
- Full access to `frontend/` directory
- Can create PRs for frontend changes
- Reviews required from Frontend Lead

**Backend Team:**
- Full access to `supabase/` directory (except migrations)
- Can create PRs for API and business logic
- Reviews required from Backend Lead

**Database Team:**
- Full access to `supabase/migrations/` directory
- Can create PRs for schema changes
- Reviews required from Technical Lead

**Documentation:**
- All teams can update documentation
- Reviews required from respective team leads

## Common Workflows

### Adding a New Feature

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/MRC-456-new-feature

# 2. Implement feature with regular commits
git add .
git commit -m "feat(scope): description"

# 3. Keep branch updated with develop
git fetch origin
git rebase origin/develop

# 4. Push to remote
git push origin feature/MRC-456-new-feature

# 5. Create PR via GitHub UI

# 6. Address review comments and push updates

# 7. After approval, merge via GitHub UI

# 8. Delete local and remote branch
git checkout develop
git branch -d feature/MRC-456-new-feature
git pull origin develop
```

### Fixing a Bug in Production (Hotfix)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/v1.0.1-critical-fix

# 2. Fix the bug
git add .
git commit -m "fix: resolve critical production issue"

# 3. Push to remote
git push origin hotfix/v1.0.1-critical-fix

# 4. Create PR to main (requires 2 approvals)

# 5. After merge to main, also merge to develop
git checkout develop
git pull origin develop
git merge hotfix/v1.0.1-critical-fix
git push origin develop

# 6. Delete hotfix branch
git branch -d hotfix/v1.0.1-critical-fix
```

### Preparing a Release

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. Update version numbers and changelog
# Edit package.json, version files, CHANGELOG.md

# 3. Commit version bump
git add .
git commit -m "chore: bump version to 1.1.0"

# 4. Push release branch
git push origin release/v1.1.0

# 5. Create PR to main
# After approval and merge to main

# 6. Tag the release
git checkout main
git pull origin main
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0

# 7. Merge back to develop
git checkout develop
git merge release/v1.1.0
git push origin develop

# 8. Delete release branch
git branch -d release/v1.1.0
```

## Conflict Resolution

### Handling Merge Conflicts

```bash
# 1. Update your branch with latest develop
git checkout feature/MRC-123-my-feature
git fetch origin
git rebase origin/develop

# 2. If conflicts occur, resolve them
# Edit conflicted files manually

# 3. Stage resolved files
git add <resolved-files>

# 4. Continue rebase
git rebase --continue

# 5. Force push (only for feature branches)
git push --force-with-lease origin feature/MRC-123-my-feature
```

### When to Ask for Help

- If conflicts are complex or affect multiple files
- If you're unsure which version to keep
- If conflicts involve database migrations or API contracts
- If rebasing seems to break functionality

**Escalation:** Ask in team Slack channel or request pair programming session

## Best Practices

### Do's

- Commit frequently with meaningful messages
- Keep commits small and focused
- Write descriptive PR descriptions
- Test your changes before creating PR
- Keep your branch up to date with develop
- Delete branches after merging
- Review code thoroughly
- Be respectful in code reviews
- Document complex logic

### Don'ts

- Don't commit directly to main or develop
- Don't force push to shared branches
- Don't merge without approval
- Don't leave commented-out code
- Don't commit secrets or credentials
- Don't commit large binary files
- Don't ignore CI/CD failures
- Don't merge with unresolved conflicts
- Don't commit without testing

## Troubleshooting

### Common Issues

**Issue: "Branch is out of date"**
```bash
git checkout feature/my-branch
git rebase origin/develop
git push --force-with-lease
```

**Issue: "Cannot delete branch"**
```bash
# If branch is not fully merged
git branch -D feature/my-branch  # Force delete
```

**Issue: "Accidentally committed to wrong branch"**
```bash
# Move last commit to new branch
git checkout correct-branch
git cherry-pick <commit-hash>
git checkout wrong-branch
git reset --hard HEAD~1
```

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 20, 2026 | TBD | Initial workflow document |
