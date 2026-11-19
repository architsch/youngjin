import * as THREE from "three";
import { GeometryConstructorMap } from "../maps/geometryConstructorMap";

const loadedGeometries: { [geometryId: string]: THREE.BufferGeometry } = {};

type GeometryVariant = "default" | "edges";

const GeometryFactory =
{
    load: async (geometryId: string, variant: GeometryVariant = "default"): Promise<THREE.BufferGeometry> =>
    {
        const cacheKey = variant === "default" ? geometryId : `${geometryId}-${variant}`;
        const loadedGeometry = loadedGeometries[cacheKey];
        if (loadedGeometry != undefined)
            return loadedGeometry;

        const geometryConstructor = GeometryConstructorMap[geometryId];
        if (geometryConstructor == undefined)
            throw new Error(`Geometry constructor not found (geometryId = ${geometryId})`);

        const baseGeometry = geometryConstructor();
        if (variant === "default")
        {
            loadedGeometries[cacheKey] = baseGeometry;
            return baseGeometry;
        }

        const edgesGeometry = new THREE.EdgesGeometry(baseGeometry);
        loadedGeometries[cacheKey] = edgesGeometry;
        return edgesGeometry;
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const url of Object.keys(loadedGeometries))
            idsTemp.push(url);
        for (const url of idsTemp)
            GeometryFactory.unload(url);
    },
    unload: (geometryId: string): void =>
    {
        const geometry = loadedGeometries[geometryId];
        if (geometry == undefined)
        {
            console.error(`Geometry is already unloaded (geometryId = ${geometryId})`);
            return;
        }
        geometry.dispose();
        delete loadedGeometries[geometryId];
    },
}

export default GeometryFactory;