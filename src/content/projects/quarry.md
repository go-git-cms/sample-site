---
blocks:
  - _variant: richText
    body: |
      Quarry walked the AST looking for feature flags whose value could no
      longer vary — flags that had been fully rolled out years earlier and left
      behind, each one a branch that would never be taken again.

      It found 340 of them, and about 40,000 lines of unreachable code.
    heading: What it did
  - _variant: richText
    body: |
      Once the backlog was cleared, Quarry found roughly one flag a quarter. A
      tool that runs on every commit to find four things a year is not paying
      for its own maintenance.

      We deleted it and wrote the lint rule that stops flags accumulating in the
      first place. Archiving it is the project working as intended, not failing.
    heading: Why it is archived
role: Engineer
seo:
  description: Quarry — static analysis that found 340 dead feature flags, removed 40,000 lines, and was then retired on purpose.
slug: quarry
status: archived
summary: A static analysis pass that found dead feature flags. Deleted 40,000 lines and then, correctly, deleted itself.
tags:
  - compilers
  - static-analysis
title: Quarry
year: 2022
---

I still think retiring a tool on purpose is underrated.
