---
excerpt: Every clever line is a loan taken out against someone else's Tuesday afternoon. Here is how I decide whether to borrow.
featured: true
publishDate: "2026-05-18"
seo:
  description: Clever code is a loan against future comprehension. A rule of thumb for deciding when the interest is worth paying.
slug: the-cost-of-clever
tags:
  - engineering
  - craft
title: The cost of clever
---

There is a particular kind of code I used to be proud of. Dense, minimal, doing
four things in one expression. Reviewers would leave a comment saying "nice" and
I would feel the way you feel when someone laughs at your joke.

That code is a loan. The interest is paid by whoever reads it next, in units of
Tuesday afternoon.

## The rule I use now

Before I write something clever, I ask one question: **will the next reader need
to know something I know, in order to change this safely?**

If the answer is no — the cleverness is local, contained, obvious in effect if
not in mechanism — then fine. A well-named function can hide almost anything.

If the answer is yes, the cleverness is not a technique. It is a dependency on
me, and I will not always be here.

## What this looks like in practice

I write more intermediate variables than I need. I unroll comprehensions that
would fit on one line. I leave the obvious branch in even when it is
unreachable, if its absence would make a reader wonder.

None of this is about being a worse programmer. It is about where I am willing
to spend the reader's attention. Attention is the scarcest resource on any team,
and clever code spends it on the mechanism instead of the problem.

## The exception

Sometimes the clever version is genuinely, measurably better — a hot path, a
correctness property that the obvious version cannot express. Then I write it,
and I write four lines above it explaining what it does and why the obvious
thing was not enough.

That comment is the interest payment. Making it up front is much cheaper than
letting it compound.
