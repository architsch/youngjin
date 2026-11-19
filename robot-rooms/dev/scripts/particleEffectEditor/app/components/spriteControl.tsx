import ParticleAtlasUtil from "../../../../../src/client/graphics/particle/util/particleAtlasUtil";
import SpriteThumbnail from "./spriteThumbnail";

// Every atlas sprite, as a picture to pick.
export default function SpriteControl({ value, onChange }: Props)
{
    return <div className="sprite-choices">
        {ParticleAtlasUtil.getSpriteIds().map(sprite => <button type="button" key={sprite}
            className={`sprite-choice${sprite == value ? " selected" : ""}`} aria-pressed={sprite == value}
            title={sprite} onClick={() => onChange(sprite)}>
            <SpriteThumbnail sprite={sprite} size={30} />
            <span className="sprite-name">{sprite}</span>
        </button>)}
    </div>;
}

interface Props
{
    value: string;
    onChange: (sprite: string) => void;
}
