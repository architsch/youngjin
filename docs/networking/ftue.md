# First-Time User Experience (FTUE)

Reference: @src/client/ui/util/ftueUtil.ts , @src/client/ui/types/ftueElementCode.ts , @src/client/ui/components/overlay/screenCoachMarks.tsx , @src/client/ui/components/overlay/screenCoachMark.tsx , @src/client/ui/uiRoot.tsx , @src/shared/user/types/user.ts , @src/server/user/util/userCommandUtil.ts , @src/server/db/types/row/dbUser.ts , @src/server/db/types/versionMigration/dbUserVersionMigration.ts

## What it is

The tutorial teaches the basics in a room of its own (see [single_player_mode.md](single_player_mode.md)). The FTUE system picks up where it leaves off: once the user is in a real room, it points out the features they have not tried yet — customizing their character, signing up, setting up their own room, hanging a picture on a wall and dressing it up.

Each such feature is an **FTUE element**. An element is *experienced* once the user has been through it, and guidance for an experienced element never appears again. That record is persisted, so it also holds across sessions.

## Coach marks

Guidance takes the form of a **coach mark**: a small text bubble that sits beside the control leading to the feature and points at it, saying in one line what that control is for. An observable carries the marks that are currently up — each naming the element it advertises, the target's DOM element id, and a line of text — and `ScreenCoachMarks` renders one `ScreenCoachMark` per entry, each following its control as the layout shifts.

A coach mark is an offer rather than an instruction, and it behaves like one:

- It ignores pointer input, so the control it advertises can be operated right through it.
- It is layered below popups, so whatever the control opens covers it.
- It shows up on whichever side of the control has room, and is pulled inward when it would otherwise hang off the edge of the screen, while its pointer stays on the control.
- It goes the instant its element is recorded as experienced — the user is already doing what it suggested, so there is nothing left to say.
- Failing that, it stays for as long as its control is on offer. A mark has no clock of its own: it draws nothing while its target is off screen (e.g. the menu holding it was closed), but that alone does not end it — see [When a coach mark goes away](#when-a-coach-mark-goes-away).

Several marks may be on screen at once. Because each is triggered by whatever UI owns its control, marks for unrelated features fall due independently, and a newcomer that replaced the mark already up would amount to guidance the user never got to read — so a new mark joins the others rather than taking their place. Each mark then lives its own life: its own target to follow and its own departure, which leaves the marks beside it untouched. A mark is identified by the element it advertises, so one feature carries at most one mark and a repeated trigger neither doubles the bubble nor extends its stay.

## When a coach mark appears

Guidance is scheduled by the UI that owns the control, and the triggers come in two shapes:

- **Dwell** — the control has been within reach, unused, for a stretch of uninterrupted time in the room. This is how the character-customization button, the sign-up button (guests only), and the own-room settings button (in the user's own room only) are advertised, each after its own wait.
- **Context** — the user has just selected something and the menu for it has opened. The mark follows a short beat later, so it does not race the menu's own appearance. This is how adding a picture to a wall, and then changing that picture's image and frame, are advertised.

Because guidance is scheduled ahead of time, the user may well discover the feature on their own before the mark is due — so `FTUEUtil` re-checks at that moment and stays quiet if there is nothing left to say.

Entering one's own room for the first time is handled by the same record but not by a coach mark: it is worth a full welcome popup, since nothing else on screen tells the user that this is the one room they are free to build in.

## When a coach mark goes away

A mark that is up stays up until something takes it down, and losing sight of its target is not enough on its own: a mark whose control has left the screen is simply not drawn, and would come back with the control — instantly, without the wait that earned it the first time — if nothing else had ended it in the meantime.

So the same condition that schedules a mark also ends it: the UI that owns the control cancels the guidance still pending *and* takes down the mark already up as soon as that control stops being on offer — the selection moving to something the feature cannot be applied to, the menu or the button leaving the screen, the user leaving the room the guidance belonged to. A control that is still on screen but disabled counts as gone this way, since a mark urging the user towards a button that does nothing is worse than no mark at all. Whichever of these ends it, the guidance is not lost: the element is still unexperienced, so the mark is scheduled afresh — wait and all — the next time its control is genuinely on offer.

## What counts as being experienced

For most elements it is the user's own use of the control: clicking it (or choosing something in the popup it opens) records the element, and recording it is also what takes its coach mark down.

For guidance whose feature ends the session — signing up takes the user away as a different user — there is no such follow-up click to wait for, so showing the mark once *is* the experience and it is recorded as it goes up. Since a record dismisses its own mark, that one is made before the mark appears rather than after, which is why `FTUEUtil` treats showing-and-recording as a single step instead of leaving the order to each call site.

## Where the record lives

The experienced elements are kept as a single string on the user record, one character per element, so that introducing a new element never needs a schema change. Two properties of that encoding matter:

- **The mapping is positional and permanent.** An element's character must never change once users have it stored.
- **Only letters are stored.** The user's record is embedded verbatim in the page that boots the client app, so a character such as a quote or a backslash finding its way in would break that page. The server enforces this on the way in, and rejects anything else.

Updating the record follows the same shape as the rest of the client-authored user state (see [user_state_management.md](user_state_management.md#user-commands)):

1. The client updates its own copy of the user immediately, so the rest of the session already knows the element is experienced.
2. The client sends the add-element user command, which the server validates, appends to the user in memory, and writes to `DBUser`.
3. The server ignores an element it already has, and never trusts the character it is given.

User records written before the field existed are migrated to an empty record, so existing users are offered the guidance rather than treated as having seen everything. Guests carry a record too, for as long as their guest account lasts.

## Restarting the tutorial

The debug route that sends a user back through the tutorial also wipes their FTUE record, so the whole first-time experience — tutorial first, then the post-tutorial guidance — runs again from the start.

## Related docs

- [Single-Player Mode](single_player_mode.md) — the tutorial the FTUE system follows, and the guidance UI it uses during it.
- [User State Management Flows](user_state_management.md) — where user state lives and how user commands reach the server.
