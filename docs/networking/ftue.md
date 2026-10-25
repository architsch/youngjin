# First-Time User Experience (FTUE)

Reference: @src/client/ui/util/ftueUtil.ts , @src/shared/user/types/ftueElementCode.ts , @src/shared/user/util/ftueElementUtil.ts , @src/client/ui/components/overlay/screenCoachMarks.tsx , @src/client/ui/components/hud/topBar/topBarMenu.tsx , @src/server/user/util/userCommandUtil.ts , @src/server/db/types/row/dbUser.ts

After the [tutorial](single_player_mode.md), the FTUE points out things nothing else on screen explains: the room can be edited, your character can be customized, your own room is yours to build in, hubs are shared, and where room settings live. Each such feature is an **FTUE element**, and once it is *experienced*, its guidance never appears again. Tools already visible in a selection menu get no coach mark. Edit mode, which the tutorial teaches, is experienced in its lesson, so its mark reaches only those who skipped it.

One element has no coach mark: `Basics`, having been told how to walk and build. The tutorial's last lesson records it, and so does the server when a helper first tells someone (see [agents.md](agents.md#helpers)), so that no helper tells them again.

## Coach marks
A coach mark is a one-line bubble pointing at a control. An observable holds the active marks (element, target DOM id, text), and `ScreenCoachMarks` renders them.
- Marks ignore pointer input, sit below popups, and stay on screen by flipping side and clamping to the edges.
- Several marks can be active at once, at most one per element.
- **Appear**: the mode switch's mark at a set time after the user lands in the page's first multiplayer room, and the person button's later, each for a while. The tutorial doesn't count, as it guides the user itself, and later rooms don't restart the clock. Room settings' mark is scheduled by the UI that owns the button, once it has been offered and unused for a while. `FTUEUtil` re-checks the element when a mark is due.
- **Disappear**: when the element is experienced, when a timed mark's while is up, or (room settings') when the owning UI reports that the control is no longer offered (hidden, disabled, or the user left the room); that pending schedule is cancelled too, and the wait restarts next time. A mark whose control is off screen draws nothing meanwhile.
- **Experienced** means the user **used the control**: opening what it opens is enough, by any route (edit mode however entered, the identity however opened). Showing a mark records nothing.
- Entering your own room or a hub for the first time shows a welcome popup instead of a coach mark, recorded the same way.

## Storage
- Experienced elements are one string on the user record, **one letter per element**.
- **Positions are permanent**: a retired element leaves a reserved gap, because shifting positions would change what returning users are credited with.
- **Only letters are allowed** (the server enforces this), because the user record is embedded verbatim in the page.
- The client updates its local user immediately and sends the add-element command. The server validates, ignores duplicates, and updates the in-memory user and `DBUser` (see [user_state_management.md](user_state_management.md)).
- An element the server records itself (`Basics`, by a helper) goes the same way, in-memory user first; the client's copy has it from the next page load.
- Older records migrate to an empty string. The restart-tutorial debug route also clears the record.
