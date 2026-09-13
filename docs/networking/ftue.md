# First-Time User Experience (FTUE)

Reference: @src/client/ui/util/ftueUtil.ts , @src/client/ui/types/ftueElementCode.ts , @src/client/ui/components/overlay/screenCoachMarks.tsx , @src/server/user/util/userCommandUtil.ts , @src/server/db/types/row/dbUser.ts

After the [tutorial](single_player_mode.md), the FTUE points out things nothing else on screen explains: your own room is yours to build in, hubs are shared, and where room settings live. Each such feature is an **FTUE element**, and once it is *experienced*, its guidance never appears again. Features the tutorial teaches, or tools that are already visible in a selection menu, are not elements.

## Coach marks
A coach mark is a one-line bubble pointing at a control. An observable holds the active marks (element, target DOM id, text), and `ScreenCoachMarks` renders them.
- Marks ignore pointer input, sit below popups, and stay on screen by flipping side and clamping to the edges.
- Several marks can be active at once, at most one per element.
- **Appear**: the UI that owns the control schedules a mark after the control has been available and unused for a while. `FTUEUtil` re-checks at that moment.
- **Disappear**: when the element is experienced, or when the owning UI reports that the control is no longer offered (hidden, disabled, or the user left the room). The pending schedule is cancelled too, and the wait restarts next time.
- **Experienced** means the user **used the control** (opening what it opens is enough). Showing a mark records nothing.
- Entering your own room or a hub for the first time shows a welcome popup instead of a coach mark, recorded the same way.

## Storage
- Experienced elements are one string on the user record, **one letter per element**.
- **Positions are permanent**: a retired element leaves a reserved gap, because shifting positions would change what returning users are credited with.
- **Only letters are allowed** (the server enforces this), because the user record is embedded verbatim in the page.
- The client updates its local user immediately and sends the add-element command. The server validates, ignores duplicates, and updates the in-memory user and `DBUser` (see [user_state_management.md](user_state_management.md)).
- Older records migrate to an empty string. The restart-tutorial debug route also clears the record.
