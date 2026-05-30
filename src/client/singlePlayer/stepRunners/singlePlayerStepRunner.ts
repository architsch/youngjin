export default abstract class SinglePlayerStepRunner
{
    abstract start(): void;
    abstract update(deltaTime: number): void;
    abstract end(): void;
}