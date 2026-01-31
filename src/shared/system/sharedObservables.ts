import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import LogEvent from "./types/logEvent";
import Observable from "./types/observable";

// Core

export const logEventObservable = new Observable<LogEvent>();

// Gameplay

export const voxelQuadChangeObservable = new Observable<VoxelQuadChange>();