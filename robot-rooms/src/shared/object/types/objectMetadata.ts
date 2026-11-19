import EncodableByteString from "../../networking/types/encodableByteString";
import { ObjectMetadataKey } from "./objectMetadataKey";

export type ObjectMetadata = {[key: ObjectMetadataKey]: EncodableByteString};