import "../../src/shared/graphics/image/imageMapDependencies";
// Composition builders are deliberately not registered here: a suite gets them only through what it
// imports, as the server does, so a server path that decodes compositions without them fails its test.
