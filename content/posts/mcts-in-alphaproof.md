---
title: "MCTS in AlphaProof | Is RL a Viable Path Towards AGI?"
date: "2025-04-13"
source: "https://omoriyumi.com/blog/2025/04/13/mtcs-in-alphaproof-is-rl-a-viable-path-towards-agi-esa-es-la-fuerza-de-la-vida/"
featured: true
---

context: A podcast about the AlphaProof

AlphaProof uses MCTS to explore the space of proof steps. Each state in the search tree is a partial proof state (the current goals and context in Lean), and each edge is a possible next step (a tactic application or theorem to use).

The action space is Lean’s tactic library, when an action is chosen, Lean checks it and returns a new state, so this state becomes a child node in the search tree.

When MCTS simulates a sequence of steps (by following the policy and occasionally exploring off-policy moves), it either reaches a terminal state or a preset search depth. A terminal state means either a complete proof was found or a dead-end. At a non-terminal leaf, the AlphaProof network’s value function provides an evaluation of how solvable the remaining state looks. This value along with the eventual outcome of a search path is backed up the tree to update the confidence in each intermediate action.

The search evaluates individual proof steps by simulating sequences of actions: if a sequence leads to a complete proof, it’s a win; if it leads to a contradiction or dead-end, that branch is pruned (or counted as a loss).

I think one of a very key reasons that it works well is that Lean can verify each proof step, so AlphaProof receives ground-truth feedback at every move, enabling a very stable reinforcement signal compared to informal reasoning approaches.

Yumi:

I was thinking, specifically in language/or the symbol systems, if we want to achieve superhuman intelligence, we actually only need two stages. 1) let the machine understand the language to communicate (and this is already achieved). 2) let it self-play with one of itself or multiple of itself against the ground truth. and that’s it. and to make the convergence faster, it would be good to make sure that it’s also capable do the following in the middle of the process (in a very abstract way): the system could abstractly transfer its current knowledge to the subsequent generation, metaphorically “dying” to allow the new generation an accelerated learning process. The new generation’s ability should be lower bounded by the previous generation. Typically, during the early lifecycle, explorative behaviors dominate, whereas towards the end, exploration should decrease to near zero.

recently i tend to think that llm actually understand the language. I used to hold the view that llm at its core is based on probabilistic computation, it’s just predicting the next word, not necessarily understanding. but I now see that this perspective confuses the concepts of consciousness and intelligence. LLMs can exhibit high intelligence without conscious awareness of sentences. In terms of the intelligence, human’s cognitive ability is highly based on a statistic/probabilistic model in our brain (computational power of the neurons, and its non-linear), namely our expectation. so this actually means that the first stage is already achieved, and ofc we can do better on that, but at least it’s enough for the second stage.

anw i’m very excited and probably just rambling right now (a bunch of confirmation bias), just want to share my thoughts.

zixuan:

I can tell you are very excited about RL and thanks for sharing your thoughts. We can discuss more in person since it is more efficient than typing. Here I briefly write down some of my thoughts:

- For me, RLHF is more like a way to constrain LLM to follow what human want it to behave, which is actually the opposite idea against building a superhuman intelligence. RLHF makes a system under human control. So I agree RLHF is definitely not the way towards super intelligence.
- In terms of language understanding, I think most of time, human are actually doing pattern matching. Examples may include the following. (1) Most of us can learn and speak the mother tongue perfectly without knowing its grammar. (2) If one reorders the characters in a Chinese sentence, it is very likely native Chinese speaker will not notice this reordering and still get the meaning their brains tell them. (3) I am in the early stage of Japanese learning. Most of time, those sentences I can say come from permutation and combination of expressions I memorized in head. Therefore, I think the basic language ability to communicate may not require the reasoning and pattern matching can cover a lot of use case
- Then, what does the superhuman symbolic system mean? We can say the current LLM is already superhuman smart, since no individual human memorize as much corpus as LLM can, and LLM can handle most of the situations where pattern matching is enough for symbolic communication. People expect more than this. I think people expect that a real superhuman intelligence can make correct decisions given ‘any’ goals. Human are driven by intentions and goals to make decision. And we see Alphaproof has better results when there is a math verifier to check whether the decisions made so far approach the goal/intention. I think if we specify a goal (e.g. a reward function) to the LLM and train it with RL like you said, e.g. self-play. I believe it can achieve superhuman performance under this goal. But I think a missing part is about the goal itself. LLM’s goals currently belong to human’s goals. How can LLM evolve towards a goal which humans do not realize? If this is possible, we can really say it is superhuman intelligence. It is a bit creepy that a thing knows the ‘answer’ before you actually state the problem.

Yumi:

I see your point. You’re suggesting that superintelligence could be defined as either “asking a question that humans cannot conjecture” or “setting a goal that requires so much intelligence humans cannot conceive it.”

Yes, regarding your first point, that’s exactly why I didn’t favor RLHF very much.

I agree that first we need a clear definition of superintelligence. You’re correct in noting that large language models (LLMs) already achieve aspects of this due to their extensive memory. However, my focus was more specifically on superhuman reasoning capabilities.

Hola a todos,

Ayer veo la película Mi mejor enemigo. Es una película sobre la guerra entre Chile y Argentina. Es una película muy buena, muy emocionante y da muchas ideas.

It is actually better than I expected. Al principio, miro el póster y estoy confundido. the term enemigo, according to the vocabulario it means enemy, but mejor means the best.

I liked this movie so much. I used to enojoy reading literatures or watching documentaries in wars a lot (to name a few, All Quiet on the Western Front, 1917, Jojo Rabbit, Dunkirk, The Wannsee Conference); not because i like seeing people being killed, but the exact the opposite. They remind me of the weight of life, how it is a priviledge to live a life without worrying about being killed/starved and full of opportunity to grow, to shine, to be educated, how precious our life and times are. in high school there was a time I wrote in my diary “The kind of youth that gets upset over trivial things is actually a blessing. Because only when pain in life is small can people afford to worry about heartbreak, parental pressure, or school admissions. For others, at the same age of eighteen, life is lived under the threat of bullets. Their greatest wish is to survive, even if just for one more second. In the face of real death, human beings are fragile. (translated one, i don’t write my diary in english)” anyways off the topic.

Humans invented intersubjective concepts like countries, religions, and motherlands to bring people a sense of belonging and purpose. These ideas have no physical form, and they exist only because people believe in them. Ironically, war flips the original intention: instead of serving humanity, these concepts now rule over it, and these once-meaningful ideas turn into tools for killing.

I like the director’s use of dry humor to convey the anti-war idea. Through a stray dog mediating bartered goods, earnest gestures of assistance, shared mutton feasts, and impromptu soccer matches under the same sky, the film quietly dismantles the absurdity of conflict. At both the beginning and end of the film, there is a line that repeats:

¿Cuánto argentino vamos a matar?

¡Sí, su caballero, vice-argento!

¿Por quién?

¡Por la patria, vice-argento!

¿De quién es una isla?

¡Chilena, vice-argento!

It’s sharp and ironic.

The ending left me feeling heart-broken, but I very much liked it. La guerra es cruel. The film doesn’t try to fix that, it just shows it.

hopefully we can all be like Sisyphus in our own lives. The wind may blow away a leaf, but it cannot blow away a butterfly.

Esa es la fuerza de la vida.
