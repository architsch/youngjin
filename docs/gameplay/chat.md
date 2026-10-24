# Chat

Reference: @src/shared/object/util/messageLinkUtil.ts , @src/shared/object/maps/objectMetadataEntryMap.ts , @src/shared/object/types/objectTypeConfig/playerObjectTypeConfig.ts , @src/client/object/components/speechBubble.ts , @src/client/ui/components/hud/chat/chatTextInput.tsx , @src/client/ui/util/chatInputEditUtil.ts , @src/client/ui/util/messageLinkOpenUtil.ts , @src/client/ui/components/form/webPageForm.tsx

What a player or NPC says is its `SentMessage`, shown in a speech bubble over it to whoever is near (`SpeechBubble`).

## Messages
- A player's shows at most `OBJECT_MESSAGE_MAX_LENGTH` characters, an NPC's (a helper's whole reply) `NPC_MESSAGE_MAX_LENGTH`. A player's past it is refused; an NPC's is cut.
- A bubble is as wide as its speaker's type has it, and widened for a message that would otherwise take more than a few lines.

## Links
- A message carries a link as markup, `<link href="https://...">label</link>`, shown as a button with its label, or else its site's name (`MessageLinkUtil`). A label too long for a button (a title, as models write) is shown as text before the button, which then shows the site's name. Only an http(s) address makes a link; any other is its label, as text.
- Every message is stored canonical (`ObjectMetadataEntryMap`): each bare web address made a link, only a few links to a message, and a link kept whole or not at all. So people, agents and helpers all send links, however they write the address.
- A link counts toward a message's length as its label, never its address.
- The chat input turns an address into a chip once a space follows it, or as it is pasted. A chip is the link, and Backspace takes it whole.
- Clicking a link (`MessageLinkOpenUtil`):
  - a room of this game goes there, after asking;
  - a page of ThingsPool's website shows over the game, in a frame that may open tabs but never navigate the game away (`WebPageForm`);
  - anything else opens in a new tab, after a prompt showing the whole address, since a label is whatever its sender wrote.
- The game won't start inside a frame of its own origin (a page in that frame linking back to the game), so a tab never runs it twice as one user.
- Agents speak by a tool, told the markup, and hear what is said as events. Helpers hear what is said near them, or to them by name, answer it with addresses only as links, and show a spinner by their name while they think of an answer (see [agents.md](../networking/agents.md#helpers)).
