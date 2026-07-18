# Grid permutation group proof

## Goal

A LaTeX writeup (`block_rotation_puzzles.tex`, titled "Which Block-Rotation
Puzzles Generate the Symmetric Group?", author Michael Albert, University of
Otago, 7 pages) proving, from scratch and by elementary means only (no
citation-only appeals to classical theorems -- everything is either proved
or explicitly flagged as a cited classical fact), exactly which $m\times n$
grids have the property that rotating every $2\times2$ block generates the
full symmetric group on all cells. Final answer (2 <= m <= n):
$$G_{m,n} = S_{mn} \iff m \ge 3 \text{ or } n \ge 4.$$

Grid labelling is always row-major, e.g. the 3x3 base case:
```
1 2 3
4 5 6
7 8 9
```

## IMPORTANT: generator convention

Generators are **genuine clockwise 90-degree rotations**: for a 2x2 block
with top-left cell $p$ and the cell below it $q$ (so $q = p + \text{width}$),
the generator is the cycle $(p\ \ p{+}1\ \ q{+}1\ \ q)$ i.e.
top-left -> top-right -> bottom-right -> bottom-left -> top-left.

This was **not** the original convention. An earlier session used the
"row-major" cycle $(p\ \ p{+}1\ \ q\ \ q{+}1)$ (matching the literal reading
order of the block, not a real rotation) -- e.g. $a=(1\,2\,4\,5)$ instead of
the correct $a=(1\,2\,5\,4)$. That version's whole 2xk analysis was
consequently wrong (it "proved" 2xk never reaches $S_{2k}$, which is false
under the correct convention: $2\times4$ and larger 2xk grids DO reach
$S_{2k}$). The entire document was rewritten once this was caught. If you
ever see the wrong-looking cycle notation again, that's the bug to check
for first.

## Structure of the document (current, as of the last edit)

1. **Introduction** -- the $3\times3$ grid (drawn via `\SetupGrid`, tiles
   with rotation-icon overlays), generators $a,b,c,d$, the "goal" sentence
   with the answer relegated to a footnote (a deliberate "Spoilers:" joke).
   Notes the result isn't new (Lam's paper) but the argument is elementary
   and self-contained. Includes a tongue-in-cheek aside where a single
   italicized sentence "blinds you with science" (cites Dolby's *She
   Blinded Me with Science* as well as Jordan's theorem) to get $G=S_9$ the
   heavy-machinery way, immediately followed by the real plan: build every
   3-cycle by hand via conjugation and symmetry.
2. **A symmetry observation** -- $D_4$ (order 8: rotations + reflections of
   the square) acts on the 9 cells, permuting the four corner blocks, hence
   acts by conjugation on $\{a,b,c,d\}$: rotations permute the generators
   among themselves, reflections send each to another generator's inverse
   (orientation-preserving vs. reversing). Hence $D_4$ normalizes $G$, so
   any fact about one triple of cells transfers to its whole $D_4$-orbit
   for free.
3. **Creating all 3-cycles** -- direct calculation $a^{-1}d^{-1}ad=(4\,5\,6)$
   gives the first 3-cycle (see the appendix lemma for the general
   principle behind why this works). The $\binom{9}{3}=84$ triples of
   cells fall into 16 $D_4$-orbits (sizes 8/4/2); a breadth-first search
   over these orbit-classes, stepping by one generator or its inverse at a
   time and rendered as a `forest` tree of `\ShowGrid` pictures, reaches
   every one of the 16 shapes by depth 3, so $G$ contains a 3-cycle of
   every possible support. Concludes $G=S_9$ (3-cycles generate $A_9$; $a$
   is a 4-cycle, hence odd, so $G \not\le A_9$; $A_9$ maximal in $S_9$).
4. **Generalization to $m\times n$ grids** ($m,n\ge3$, Theorem 1) -- any
   adjacent pair of cells sits in some $3\times3$ sub-window, whose local
   group is $S_9$ by Sections 2-3, giving every adjacent transposition;
   connectivity of the grid graph finishes it.
5. **The $2\times n$ strip** (the interesting/hard case, $m=2$):
   - $n=2$: trivial, cyclic of order 4.
   - $n=3$: $|G_3|=120<720=|S_6|$ by direct computation, primitive,
     contains no 3-cycle, conjugacy class sizes match $S_5$'s. **Theorem 2
     proves $G_3 \cong S_5$ rigorously** (not just fingerprint-suggestive):
     trivial centre; derived subgroup $D=G_3'$ has order 60, hence index 2,
     hence normal; $D$ is simple (conjugacy-class subset-sum argument on
     sizes $1,12,12,15,20$ -- no nontrivial proper divisor of 60 is
     achievable), hence $D\cong A_5$ (unique simple group of that order);
     $G_3$ embeds into $\mathrm{Aut}(A_5)\cong S_5$ by conjugation,
     injectively (else the kernel gives a nontrivial centre), hence
     bijectively by order. So $G_3$ really is the classical exotic
     degree-6 representation $S_5\cong\mathrm{PGL}(2,5)$. See
     `references.md` and `verify_g3_iso_s5()` in `grid_group.py`.
   - $n=4$: $G_4=S_8$, proved via the same symmetry+BFS style as the 3x3
     case rather than Jordan's theorem or the old moving-lemma machinery
     (both approaches were tried in earlier drafts and fully replaced, not
     just commented out -- see git-free history in this file's own past
     revisions if ever needed, though at this point it's simplest to trust
     the `.tex` as sole source of truth). Only $V_4=\{e,h,v,hv\}$ (Klein
     four: left-right mirror, top-bottom mirror, $180^\circ$ rotation) is
     available, not full $D_4$, since a $2\times4$ strip isn't square.
     Initial 3-cycle $(2\,3\,4)$ from a two-point-overlap commutator
     (double transposition first, then the appendix lemma). Every
     non-identity element of $V_4$ is a fixed-point-free involution, so
     every $V_4$-orbit of a 3-subset has full size 4, giving exactly 14
     orbits; BFS tree (6 possible edges per node: $g_1,g_2,g_3$ and
     inverses) reaches all 14 by depth 3.
   - $n\ge5$: same 2x4-window argument as the $m,n\ge3$ generalization,
     bootstrapped from the $n=4$ base case.
6. **The complete answer** (Theorem 4) -- combines the above into the iff
   statement.
7. **Acknowledgements** -- thanks Claude for the computational verification
   and drafting help; links to the Tintangle/Wordtangle puzzles (Michael's
   own, at `https://michael-albert-dun.github.io/`) that inspired the
   whole investigation.
8. **Appendix A: a lemma on single-point overlaps** -- the one genuinely
   reusable lemma (if two permutations' supports meet in exactly one point
   $x$, their commutator is the 3-cycle $(y\,x\,z)$, $y=x^\sigma$,
   $z=x^\tau$), used in both the 3x3 and 2x4 sections. Framed as standard/
   folklore rather than original, with citations to where the same
   commutator trick appears (Dixon-Mortimer's proof that a primitive group
   containing a 3-cycle contains $A_n$; Wilson's graph-puzzle-group paper).
   This is also where the exponential/point-image notation ($x^\sigma$)
   and the plain-English definition of "support" now live -- **deliberately
   not needed anywhere in the main body any more** (Sections 1-6 are all
   written in prose: "conjugates X to Y", "sends $a\mapsto b$", etc.); only
   this appendix lemma's statement and proof actually need the notation.
   There's also no `$\mathrm{supp}(\cdot)$` shorthand anywhere any more --
   the appendix proof just uses "the support of $\sigma$" / "$S$" and "$T$"
   directly rather than defining and then using the abbreviation.
9. **Bibliography** (`thebibliography`, alphabetical by first author's
   surname): Dixon & Mortimer (*Permutation Groups*, for Jordan's theorem
   and the standard commutator-trick proof), Dolby (*She Blinded Me with
   Science*, the joke citation -- YouTube link, genuinely clickable),
   Dummit & Foote (*Abstract Algebra*, for "$A_5$ is the unique simple
   group of order 60"), Janusz & Rotman (outer automorphisms of $S_6$, for
   the exotic $S_5$ representation), Jordan (1873 original), Lam (the
   arXiv number-rotation-puzzle paper this whole thing is a variation on),
   Wilson (graph puzzles / alternating group, for the commutator-is-a-3-
   cycle trick in puzzle-group form).

## Conventions used throughout

- Permutations compose **left to right**: $x^{\sigma\tau} = (x^\sigma)^\tau$.
- Point-image notation $x^\sigma$ is defined in the Introduction but only
  actually *used* in Appendix A (see point 8 above) -- the main body's
  arguments are all phrased as prose conjugation statements instead.
- `\parindent` 0pt, `\parskip` 1ex. Trim redundant restatements once a
  displayed equation makes the content clear.
- `\usepackage[hidelinks,bookmarks=false]{hyperref}` is loaded (after
  `\usepackage{url}`) so `\url{}` links are genuinely clickable in the PDF.
  **`bookmarks=false` is load-bearing, not optional**: several
  `\subsection*{...}` titles contain inline math (e.g. `$n=4$: Full, via
  symmetry...`), and hyperref's default PDF-bookmark string-expansion
  chokes on that combination (`Paragraph ended before \Hy@setref@link was
  complete`) unless bookmarks are disabled. If PDF bookmarks are ever
  wanted back, the fix is wrapping the math in each such heading with
  `\texorpdfstring{...}{...}`, not just re-enabling `bookmarks`.

## Supporting files

- `grid_group.py` -- computational side-kick, kept in sync with the paper.
  `grid_generators(rows,cols)` builds the true-rotation generators;
  `report()` does brute-force BFS (fine up to ~9 cells); `group_order()`
  uses sympy's Schreier-Sims for anything bigger (essential once $mn$
  gets large -- brute enumeration of e.g. $S_{12}$ is 479001600 elements
  and will just hang); `verify_2x4_elementary_proof()` checks every single
  claim in the old (no longer used) $n=4$ construction line-by-line;
  `verify_g3_iso_s5()` checks every claim in the Theorem 2 proof that
  $G_3 \cong S_5$ (trivial centre, derived subgroup order/index, its
  conjugacy class sizes, and the subset-sum simplicity check -- not the
  two classical inputs, which are cited rather than re-derived);
  `verify_final_theorem()` sweeps $2\le m\le n\le6$ and confirms the iff
  claim exactly (including astronomically large cases like 6x6, order
  ~3.7e44, that only Schreier-Sims can touch).
- `references.md` -- literature notes on the 2x3 case, closed thread: Lam's
  paper independently confirms $|G_3|=120$; the $G_3\cong S_5$
  identification (previously just "almost certainly true" by fingerprint)
  is now proved directly for this construction (Theorem 2), not merely
  inferred.

## Status / possible next steps

Compiles cleanly with `pdflatex` (run twice), 7 pages, no errors, every
numeric/group-theoretic claim double-checked computationally before being
written up. $G_3 \cong S_5$ is proved rigorously (Theorem 2). The 3x3 and
2x4-strip cases are both told in a geometric style (symmetry group
normalizes $G$, then a short BFS over symmetry-classes of 3-cycle supports)
rather than via Jordan's theorem or a bespoke moving lemma; the old
approaches were fully replaced rather than left as dead commented-out code.

The web-based, low-jargon presentation of the material (`index.html`,
"Corner Cases") is also complete: an interactive walkthrough of the same
argument in casual prose, built around click-to-rotate demos rather than
static diagrams.
