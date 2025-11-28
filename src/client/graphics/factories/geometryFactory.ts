import * as THREE from "three";
import { GeometryConstructorMap } from "../maps/geometryConstructorMap";

const loadedGeometries: { [geometryId: string]: THREE.BufferGeometry } = {};

const GeometryFactory =
{
    load: async (geometryId: string): Promise<THREE.BufferGeometry> =>
    {
        const loadedGeometry = loadedGeometries[geometryId];
        if (loadedGeometry != undefined)
            return loadedGeometry;
        
        const geometryConstructor = GeometryConstructorMap[geometryId];
        if (geometryConstructor == undefined)
            throw new Error(`Geometry constructor not found (geometryId = ${geometryId})`);
        const newGeometry = geometryConstructor();
        loadedGeometries[geometryId] = newGeometry
        return newGeometry;
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