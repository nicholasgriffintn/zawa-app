import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  textNodeName: "Value",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function parseRdmXml(value: string): unknown {
  return parser.parse(value);
}
