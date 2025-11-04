import * as THREE from "three";

const loadedGeometries: { [geometryId: string]: THREE.BufferGeometry } = {};

const positionsTemp: number[] = [];
const uvsTemp: number[] = [];
const mat4Temp: THREE.Matrix4 = new THREE.Matrix4();
const vec3Temp: THREE.Vector3 = new THREE.Vector3();
const axisX = new THREE.Vector3(1, 0, 0);
const axisY = new THREE.Vector3(0, 1, 0);
const axisZ = new THREE.Vector3(0, 0, 1);

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
    "Quad": () => {
        clear();
        writeZFacingUnitQuad();
        return makeGeometry();
    },
}

function makeGeometry(): THREE.BufferGeometry
{
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positionsTemp), 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvsTemp), 2));
    geometry.computeVertexNormals();
    return geometry;
}

function clear()
{
    positionsTemp.length = 0;
    uvsTemp.length = 0;
}

function writeUnitSideBox(y: number)
{
    writeZFacingUnitQuad();
    translate(6, 0, y, 0.5);
    writeZMinusFacingUnitQuad();
    translate(6, 0, y, -0.5);
    writeXFacingUnitQuad();
    translate(6, 0.5, y, 0);
    writeXMinusFacingUnitQuad();
    translate(6, -0.5, y, 0);
}

function writeXMinusFacingUnitQuad()
{
    writeZFacingUnitQuad();
    rotate(6, axisY, -90);
}

function writeXFacingUnitQuad()
{
    writeZFacingUnitQuad();
    rotate(6, axisY, 90);
}

function writeYMinusFacingUnitQuad()
{
    writeZFacingUnitQuad();
    rotate(6, axisX, 90);
}

function writeYFacingUnitQuad()
{
    writeZFacingUnitQuad();
    rotate(6, axisX, -90);
}

function writeZMinusFacingUnitQuad()
{
    writeZFacingUnitQuad();
    rotate(6, axisY, 180);
}

function writeZFacingUnitQuad()
{
    for (const position of unitQuadPositions)
        positionsTemp.push(position);
    for (const uv of unitQuadUVs)
        uvsTemp.push(uv);
}

function translate(numRecentlyAddedVerticesToTransform: number, x: number, y: number, z: number)
{
    vec3Temp.set(x, y, z);
    mat4Temp.makeTranslation(vec3Temp);
    transformVertices(numRecentlyAddedVerticesToTransform);
}

function rotate(numRecentlyAddedVerticesToTransform: number, axis: THREE.Vector3, angleInDeg: number)
{
    mat4Temp.makeRotationAxis(axis, angleInDeg * 0.01745329);
    transformVertices(numRecentlyAddedVerticesToTransform);
}

function transformVertices(numRecentlyAddedVerticesToTransform: number)
{
    const n = positionsTemp.length;
    for (let i = 0; i < numRecentlyAddedVerticesToTransform; ++i)
    {
        const ind1 = n-1 - 3*i;
        const ind2 = n-2 - 3*i;
        const ind3 = n-3 - 3*i;
        vec3Temp.set(positionsTemp[ind3], positionsTemp[ind2], positionsTemp[ind1]);
        vec3Temp.applyMatrix4(mat4Temp);
        positionsTemp[ind1] = vec3Temp.z;
        positionsTemp[ind2] = vec3Temp.y;
        positionsTemp[ind3] = vec3Temp.x;
    }
}

const unitQuadPositions = [
    -0.5, +0.5, 0.0,
    -0.5, -0.5, 0.0,
    +0.5, -0.5, 0.0,
    +0.5, -0.5, 0.0,
    +0.5, +0.5, 0.0,
    -0.5, +0.5, 0.0,
]

const unitQuadUVs = [
    0.0, 1.0,
    0.0, 0.0,
    1.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
]

export default GeometryFactory;