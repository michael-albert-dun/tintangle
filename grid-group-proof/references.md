# References found for the 2x3 grid rotation group (|G_3| = 120)

- Thomas Lam, "Solution to the Number Rotation Puzzle," arXiv:2211.16787
  (math.CO), 30 Nov 2022. Local copy: `lam_number_rotation_puzzle.pdf`.
  Studies NRP(n,m,b): an n x m board with b x b rotating blocks. Our 3x3
  grid with 2x2 rotations is literally his "standard NRP." Our 2x3 grid
  with 2x2 rotations is his case (2,3,2); Section 5.1 states, citing Jaap
  Scherphuis: "out of all 6! theoretically reachable permutations in the
  (2,3,2) variation, only 5! are achievable" -- confirms |G_3| = 120
  independently of our computation. Separately (Section 5.3), the case
  (3,4,3) -- a 3x4 board with 3x3 blocks -- gives "a novel construction
  of the exotic outer automorphism on S_6"; this is a different case from
  ours and Lam does not connect (2,3,2) to S_5 or PGL(2,5) explicitly.

- Jaap Scherphuis, "Two-generator corners group,"
  https://www.jaapsch.net/puzzles/pgl25.htm
  A different puzzle (a Rubik's-cube corner group using only two face-turn
  generators) that also acts on 6 objects with exactly 5! = 120 reachable
  configurations. Proves this group is isomorphic to both S_5 and
  PGL(2,5), via the classical "5 pairing patterns" (synthemes) argument --
  the standard combinatorial route to the exotic outer automorphism of
  S_6. Not our construction, but the same underlying group-theoretic
  phenomenon (order-120, degree-6, exotic S_5 action), fully proved here.

Net conclusion: |G_3| = 120 for the 2x3 grid is independently documented
(Lam, citing Scherphuis). The identification of G_3 with the exotic
S_5 = PGL(2,5) representation is not written down anywhere I found for
this specific grid-rotation construction -- but it is now proved directly
for our construction (Theorem 2 in `block_rotation_puzzles.tex`, verified by
`verify_g3_iso_s5()` in `grid_group.py`), rather than merely inferred from
the class-size fingerprint: Z(G_3)=1, the derived subgroup G_3' has order
60 and is simple (hence isomorphic to A_5, the unique simple group of that
order), and G_3 embeds into Aut(A_5) = S_5 by conjugation, injectively
(else the kernel would give a nontrivial centre) and hence bijectively (by
order). Closed, no longer an open thread.
