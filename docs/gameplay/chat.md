# Chat

Reference: @src/shared/object/util/messageLinkUtil.ts , @src/server/user/util/playerMessageExpiryUtil.ts , @src/shared/object/maps/screenControlMap.ts , @src/client/ui/components/basic/screenControlPicture.tsx , @src/shared/object/maps/objectMetadataEntryMap.ts , @src/shared/object/types/objectTypeConfig/playerObjectTypeConfig.ts , @src/client/object/components/speechBubble.ts , @src/client/ui/components/hud/chat/chatTextInput.tsx , @src/client/ui/util/chatInputEditUtil.ts , @src/client/ui/util/chatTypingUtil.ts , @src/client/ui/util/messageLinkOpenUtil.ts , @src/client/ui/components/form/webPageForm.tsx

What a player or NPC says is its `SentMessage`, shown in a speech bubble over it to whoever is near (`SpeechBubble`).

## Messages
- A player's shows at most `OBJECT_MESSAGE_MAX_LENGTH` characters, an NPC's (a helper's whole reply) `NPC_MESSAGE_MAX_LENGTH`. A player's past it is refused; an NPC's is cut.
- A bubble is as wide as its speaker's type has it, and widened for a message that would otherwise take more than a few lines.
- A player in edit mode shows "Editing..." in place of its message, which shows again as the mode ends (see [game_mode.md](game_mode.md)).
- A player's message clears itself `PLAYER_MESSAGE_EXPIRATION_MS` after it is said, or after its player arrives in a room still saying it (`PlayerMessageExpiryUtil`). The server clears it for the room as its user would, and the user's browser for itself, so a line said just as the last one runs out is never cleared with it.

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
- Agents speak by a tool, told the markup, and hear what is said as events. Helpers hear what is said near them, or to them by name, or still shows over someone who comes near, stand still facing whoever types them a line (`ChatTypingUtil`), answer it with addresses only as links, and show a spinner by their name while they think of an answer (see [agents.md](../networking/agents.md#helpers)).

## Pictures of controls
- A message shows a small copy of a control on the screen where it carries `<control name="..."/>` (`ScreenControlMap`), so a helper shows the button it means rather than say where on the screen it is. A name no control has is shown as that name, in text.
- Stored as written there, and counted toward a message's length as the control's words, kept whole or not at all.
- Drawn as the control is, from its icon and face (`ScreenControlPicture`), sized by the text around it and taking no presses. A bubble isn't React's, so each picture is drawn by React once and copied (`ScreenControlPictureUtil`).
- **Trap**: a picture is a copy made by hand, so a redesigned control keeps its old picture. Whenever a pictured control's look changes, change its picture to match in the same change.
- Agents, with no screen, hear a picture as the control's words in square brackets.
