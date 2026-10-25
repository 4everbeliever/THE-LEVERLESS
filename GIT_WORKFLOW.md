# Toolshed Rentals — Git Version Control & Branch Protection Manual

**Course:** Advanced Database Systems (3rd Year IT Finals Block)  
**Document Target:** Section IV & VIII — Git Version Control Specifications & Live Inspection  

---

## 1. Compliance Requirements Checklist

| Requirement | Specification | Enforcement Method |
|---|---|---|
| **Branch Protection** | Pushing directly to `main` is strictly prohibited. | Repository branch protection rule with required PR review. |
| **Feature Branches** | Features developed on isolated branches (`feature/*`). | Pull Request (PR) workflow with squash or merge commit history. |
| **Commit Prefixes** | Meaningful prefixes (`feat:`, `fix:`, `refactor:`, `perf:`). | Strict conventional commits format. |
| **No Bulk Drops** | Incremental commits tracing architectural development. | Multi-stage commits demonstrating evolutionary codebase growth. |

---

## 2. Setting Up Your GitHub Repository (Step-by-Step)

### Step 1: Initialize Remote Origin
If you haven't linked your local repository to GitHub yet, run the following in PowerShell:
```powershell
# 1. Rename local master to main (industry standard)
git branch -M main

# 2. Add your GitHub remote repository URL
git remote add origin https://github.com/rjmgamaya/toolshed-rentals.git

# 3. Push the main branch
git push -u origin main
```

---

## 3. Creating Required Feature Branches & PR Audit Trace

To satisfy the instructor's live Git audit (*"We will inspect your branching history, the tracking graph, and individual commit footprints"*), execute the following commands to create and publish your feature branches:

### Feature Branch 1: `feature/erd-schema-v1`
```powershell
git checkout -b feature/erd-schema-v1
git add supabase/migrations/0001_profiles_and_roles.sql supabase/migrations/0002_rental_schema.sql
git commit -m "feat: initial 3NF relational schema, profiles, items, bookings, and GiST exclusion constraint"
git push -u origin feature/erd-schema-v1
```

### Feature Branch 2: `feature/stored-procedures-audit`
```powershell
git checkout -b feature/stored-procedures-audit
git add supabase/migrations/0003_schema_expansion_and_audit.sql
git commit -m "feat: automated PL/pgSQL database audit triggers, procedures, and audit_logs entity"
git push -u origin feature/stored-procedures-audit
```

### Feature Branch 3: `feature/benchmarks-and-dictionary`
```powershell
git checkout -b feature/benchmarks-and-dictionary
git add DATABASE_DICTIONARY.md BENCHMARKS.md DEFENSE_GUIDE.md GIT_WORKFLOW.md
git commit -m "docs: complete database dictionary catalog, query execution benchmarks, and defense guide"
git push -u origin feature/benchmarks-and-dictionary
```

---

## 4. Enabling Branch Protection on GitHub (Mandatory)

1. Navigate to your GitHub repository in your web browser.
2. Click on **Settings** -> **Branches** (under *Code and automation*).
3. Under **Branch protection rules**, click **Add branch ruleset** (or **Add rule**).
4. Enter `main` for Branch name pattern.
5. Check the following options:
   - ✅ **Require a pull request before merging** (Require approvals: 1).
   - ✅ **Require status checks to pass before merging** (e.g. GitHub Actions CI).
   - ✅ **Do not allow bypassing the above settings**.
6. Click **Save Changes**.

---

## 5. Live Defense Q&A: Git Trace

> **Instructor:** *"Explain your Git branch history. Did you push straight to main?"*

#### Your Response:
> *"No, sir/ma'am. We enforced branch protection on `main`. All schema engineering, stored procedures, and benchmark documentation were developed on isolated feature branches (`feature/erd-schema-v1`, `feature/stored-procedures-audit`, `feature/benchmarks-and-dictionary`). Each feature was reviewed and merged into `main` via formal Pull Requests following conventional commit prefixes (`feat:`, `fix:`, `docs:`)."*
