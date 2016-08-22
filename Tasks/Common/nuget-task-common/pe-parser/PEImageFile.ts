import IReadableFile from "./IReadableFile";
import {SectionTable, SectionTableEntry} from "./SectionTable";

const peSignature = 0x00004550;
const dosSignature = 0x5A4D;

const sizeOfCoffHeader = 20;

export interface CoffHeader {
    machine: number;
    numberOfSections: number;
    timeDateStamp: number;
    pointerToSymbolTable: number;
    numberOfSymbols: number;
    sizeOfOptionalHeader: number;
    characteristics: number;
}

export class PEImageFile {
    constructor(public coffHeader: CoffHeader, public sectionTable: SectionTable) { }

    public static async readAsync(file: IReadableFile): Promise<PEImageFile> {
        let buffer = new Buffer(1024).fill(0);

        // read the DOS signature
        await file.readAsync(buffer, 0, 2, 0);
        const dosSignatureValue = buffer.readUInt16LE(0);
        if (dosSignatureValue !== dosSignature) {
            throw "unexpected dos signature";
        }

        // read the pointer to the PE signature
        await file.readAsync(buffer, 0, 4, 0x3c);
        const filePositionOfPEHeader = buffer.readUInt32LE(0);

        // read the PE signature
        await file.readAsync(buffer, 0, 4, filePositionOfPEHeader);
        const peSignatureValue = buffer.readUInt32LE(0);
        if (peSignatureValue !== peSignature) {
            throw "unexpected pe signature";
        }

        // the COFF header begins immediately after the PE signature
        const filePositionOfCoffHeader = filePositionOfPEHeader + 4;
        await file.readAsync(buffer, 0, sizeOfCoffHeader, filePositionOfCoffHeader);
        const coffHeader: CoffHeader = {
            machine: buffer.readUInt16LE(0),
            numberOfSections: buffer.readUInt16LE(2),
            timeDateStamp: buffer.readUInt32LE(4),
            pointerToSymbolTable: buffer.readUInt32LE(8),
            numberOfSymbols: buffer.readUInt32LE(12),
            sizeOfOptionalHeader: buffer.readUInt16LE(16),
            characteristics: buffer.readUInt16LE(18),
        };

        // the Optional Header begins immediately after the COFF header
        const filePositionOfOptionalHeader = filePositionOfCoffHeader + sizeOfCoffHeader;

        // the section table begins immediately after the Optional Header
        const filePositionOfSectionTable = filePositionOfOptionalHeader + coffHeader.sizeOfOptionalHeader;
        let sectionTable = await SectionTable.readAsync(
            file,
            buffer,
            filePositionOfSectionTable,
            coffHeader.numberOfSections);

        return new PEImageFile(coffHeader, sectionTable);
    }

    public getSection(name: string): SectionTableEntry {
        return this.sectionTable.getSection(name);
    }
}

export default PEImageFile;
