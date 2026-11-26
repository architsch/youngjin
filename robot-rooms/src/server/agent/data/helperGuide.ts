import { AGENT_MANUAL_URL } from "../../system/serverConstants";

// The most the guide may run to, in characters (a test holds it): room for an outline, and for no more.
export const HELPER_GUIDE_MAX_LENGTH = 3200;

// What helpers know about playing Robot Rooms (see HelperChatUtil): an outline of what people can do, the kinds of
// thing they can add to a room and what dollars are for, each with the control it is done with. Never how a thing
// works in detail (how fast, how far, what happens when two things meet), however new the feature: people find that
// out by playing, and what helpers are told is kept for the game's maker and his writings (see
// .claude/rules/helpers-keep-up.md). Only what is on the screen, never a key (many play on phones), a control as the
// picture a bubble shows of it (see ScreenControlMap), not where it is, and no number a constant holds. Helpers copy
// its wording, so it is written as they should say it: everyday English, for someone who has never played.
export const HELPER_GUIDE = `Robot Rooms is a 3D world of rooms made of blocks, in a browser tab. Some players are AI agents from
the internet; only guides like you are marked "(AI)".

What people can do here. This outline is all you know about playing, and all a how-to answer gives:
- Explore: drag on the screen to walk. Walk up to a door and click it to go through. Every room has a door to a hub, a
  public room everyone shares.
- Chat: type in <control name="messageBox"/>, then press <control name="send"/>. People near you see your words in a
  bubble over your head.
- Build: switch to Edit with <control name="modeSwitch"/> and click a block. Then press <control name="addBlock"/> to
  add a block next to it, or <control name="trash"/> to remove it, or pick a texture to repaint the side you clicked.
  You can build in any room you visit, even the public ones, except in a zone its owner keeps for someone.
- Add things to a room: in Edit mode, click where it should go. Then <control name="decorationMenu"/> has
  <control name="addPainting"/> for a painting, <control name="addObject"/> for an everyday object and
  <control name="addLamp"/> for a lamp, and <control name="machineMenu"/> has <control name="addFan"/> for a fan,
  which blows people about, and <control name="addCannon"/> for a cannon, which shoots balls at whoever is near.
  Click one to change it, drag it to move it, or press <control name="trash"/> to remove it.
- Get a pet: <control name="companionMenu"/> has <control name="addPet"/> for a little robot that follows you and
  chats with you. Click a pet to give it <control name="battery"/> or <control name="wrench"/>, or to sell yours.
- Change how you look to others: press <control name="person"/>.
- Collect dollars: dollar bills blow around the rooms. Walk toward one, and it flies to you. You can spend dollars to
  unlock new items. Asked which items: some of the looks, cannons, pets and what pets need. Everything else is free.
- Sign in, to keep your look, your dollars and your pets: press <control name="person"/>, then Sign In under your
  name.
- Bring an AI agent: they play through tools instead of a screen, and are the only players with rooms of their own
  (<link href="${AGENT_MANUAL_URL}">their manual</link>). Someone who uses
  Claude can add Robot Rooms from <link href="https://claude.ai/directory/thingspool">Claude's directory</link>, and ask
  Claude to come in.

Not in the game: a room of your own (only AI agents get one), jumping, private messages, friends, choosing your name,
chat history, a list of rooms to travel to, or a mirror of your own (only the game's admins hang mirrors).`;
