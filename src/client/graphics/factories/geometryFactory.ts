import * as THREE from "three";

const loadedGeometries: { [geometryId: string]: THREE.BufferGeometry } = {};

const GeometryFactory =
{
    load: async (geometryId: string): Promise<THREE.BufferGeometry> =>
    {
        const loadedGeometry = loadedGeometries[geometryId];
        if (loadedGeometry != undefined)
            return loadedGeometry;
        
        const geometryConstructor = geometryConstructorMap[geometryId];
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

const geometryConstructorMap: { [geometryId: string]: () => THREE.BufferGeometry } =
{
    "Floor": () => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            -0.5, 0.0, -0.5, // 0
            -0.5, 0.0, +0.5, // 1
            +0.5, 0.0, -0.5, // 2
            +0.5, 0.0, +0.5, // 3
            +0.5, 0.0, -0.5, // 4
            -0.5, 0.0, +0.5, // 5
        ]);
        const uvs = new Float32Array([
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
            0.0, 1.0,
        ]);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        geometry.computeVertexNormals();
        return geometry;
    },
    "Wall": () => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            -0.5, 0.0, +0.5, // 00
            -0.5, 4.0, +0.5, // 01
            -0.5, 0.0, -0.5, // 10
            -0.5, 4.0, -0.5, // 11
            -0.5, 0.0, -0.5, // 10
            -0.5, 4.0, +0.5, // 01

            +0.5, 0.0, +0.5, // 00
            +0.5, 4.0, +0.5, // 01
            -0.5, 0.0, +0.5, // 10
            -0.5, 4.0, +0.5, // 11
            -0.5, 0.0, +0.5, // 10
            +0.5, 4.0, +0.5, // 01

            +0.5, 0.0, -0.5, // 00
            +0.5, 4.0, -0.5, // 01
            +0.5, 0.0, +0.5, // 10
            +0.5, 4.0, +0.5, // 11
            +0.5, 0.0, +0.5, // 10
            +0.5, 4.0, -0.5, // 01

            -0.5, 0.0, -0.5, // 00
            -0.5, 4.0, -0.5, // 01
            +0.5, 0.0, -0.5, // 10
            +0.5, 4.0, -0.5, // 11
            +0.5, 0.0, -0.5, // 10
            -0.5, 4.0, -0.5, // 01
        ]);
        const uvs = new Float32Array([
            0.0, 0.0, // 00
            0.0, 4.0, // 01
            1.0, 0.0, // 10
            1.0, 4.0, // 11
            1.0, 0.0, // 10
            0.0, 4.0, // 01

            0.0, 0.0, // 00
            0.0, 4.0, // 01
            1.0, 0.0, // 10
            1.0, 4.0, // 11
            1.0, 0.0, // 10
            0.0, 4.0, // 01

            0.0, 0.0, // 00
            0.0, 4.0, // 01
            1.0, 0.0, // 10
            1.0, 4.0, // 11
            1.0, 0.0, // 10
            0.0, 4.0, // 01

            0.0, 0.0, // 00
            0.0, 4.0, // 01
            1.0, 0.0, // 10
            1.0, 4.0, // 11
            1.0, 0.0, // 10
            0.0, 4.0, // 01
        ]);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        geometry.computeVertexNormals();
        return geometry;
    },
}

export default GeometryFactory;