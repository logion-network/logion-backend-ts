import { setupApp } from "../../helpers/testapp";
import { LoFileController } from "../../../src/logion/controllers/lofile.controller";
import { Container } from "inversify";
import { Mock, It, Times } from "moq.ts";
import { FileStorageService, FileId } from "../../../src/logion/services/file.storage.service";
import {
    LoFileDescription,
    LoFileFactory,
    LoFileAggregateRoot,
    LoFileRepository
} from "../../../src/logion/model/lofile.model";
import request from "supertest";
import { writeFile } from "fs/promises";

const existingFile: LoFileDescription = {
    id: 'file1',
    contentType: 'text/plain',
    oid: 123
}
const newFile: LoFileDescription = {
    id: 'file2',
    contentType: 'text/plain',
    oid: 456
}

let fileStorageService: Mock<FileStorageService>;
let factory: Mock<LoFileFactory>;
let repository: Mock<LoFileRepository>;

const fileContent = "file content";
const buffer = Buffer.from(fileContent);

describe("LoFileController", () => {

    it("uploads an new file", async () => {

        const app = setupApp(LoFileController, mockModel, true, true)

        await request(app)
            .put(`/api/lo-file/${ newFile.id }`)
            .attach('file', buffer, { filename: "file-name", contentType: 'text/plain' })
            .expect(204)

        factory.verify(instance => instance.newLoFile(It.Is<LoFileDescription>(param =>
            param.id === newFile.id &&
            param.contentType === newFile.contentType &&
            param.oid === newFile.oid
        )))
        fileStorageService.verify(instance => instance.deleteFile(It.IsAny<FileId>()), Times.Never())
        fileStorageService.verify(instance => instance.importFileInDB(It.IsAny<string>(), newFile.id))
        repository.verify(instance => instance.save(It.IsAny<LoFileAggregateRoot>()))
    });

    it("uploads an existing file", async () => {

        const app = setupApp(LoFileController, mockModel, true, true)

        await request(app)
            .put(`/api/lo-file/${ existingFile.id }`)
            .attach('file', buffer, { filename: "file-name", contentType: 'text/plain' })
            .expect(204)

        factory.verify(instance => instance.newLoFile(It.IsAny<LoFileDescription>()), Times.Never())
        fileStorageService.verify(instance => instance.deleteFile(It.IsAny<FileId>()))
        fileStorageService.verify(instance => instance.importFileInDB(It.IsAny<string>(), existingFile.id))
        repository.verify(instance => instance.save(It.IsAny<LoFileAggregateRoot>()))
    });

    it("downloads", async () => {

        const app = setupApp(LoFileController, mockModel, true, true)

        const filePath = `/tmp/download-${ existingFile.id }`;
        await writeFile(filePath, fileContent);

        await request(app)
            .get(`/api/lo-file/${ existingFile.id }`)
            .expect(200, fileContent)
            .expect('Content-Type', /text\/plain/);
    });

    it("fails to upload an new file if not owner", async () => {

        const app = setupApp(LoFileController, mockModel, true, false)

        await request(app)
            .put(`/api/lo-file/${ newFile.id }`)
            .attach('file', buffer, { filename: "file-name", contentType: 'text/plain' })
            .expect(401)

        fileStorageService.verify(instance => instance.deleteFile(It.IsAny<FileId>()), Times.Never())
        fileStorageService.verify(instance => instance.importFileInDB(It.IsAny<string>(), newFile.id), Times.Never())
        repository.verify(instance => instance.save(It.IsAny<LoFileAggregateRoot>()), Times.Never())
    });

    it("fails to upload an existing file if not owner", async () => {

        const app = setupApp(LoFileController, mockModel, true, false)

        await request(app)
            .put(`/api/lo-file/${ existingFile.id }`)
            .attach('file', buffer, { filename: "file-name", contentType: 'text/plain' })
            .expect(401)

        fileStorageService.verify(instance => instance.deleteFile(It.IsAny<FileId>()), Times.Never())
        fileStorageService.verify(instance => instance.importFileInDB(It.IsAny<string>(), existingFile.id), Times.Never())
        repository.verify(instance => instance.save(It.IsAny<LoFileAggregateRoot>()), Times.Never())
    });

    it("fails to download if not owner", async () => {

        const app = setupApp(LoFileController, mockModel, true, false)

        await request(app)
            .get(`/api/lo-file/${ existingFile.id }`)
            .expect(401);
    });
})

function mockModel(container: Container): void {

    fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    fileStorageService.setup(instance => instance.importFileInDB(It.IsAny<string>(), It.IsAny<string>()))
        .returns(Promise.resolve(newFile.oid));
    fileStorageService.setup(instance => instance.deleteFile(It.IsAny<FileId>()))
        .returns(Promise.resolve());
    fileStorageService.setup(instance => instance.exportFile(It.IsAny<FileId>(), It.IsAny<String>()))
        .returns(Promise.resolve())

    factory = new Mock<LoFileFactory>();
    container.bind(LoFileFactory).toConstantValue(factory.object());

    const existingEntity = new Mock<LoFileAggregateRoot>()
    existingEntity.setup(instance => instance.contentType)
        .returns(existingFile.contentType)
    existingEntity.setup(instance => instance.oid)
        .returns(existingFile.oid)
    existingEntity.setup(instance => instance.update(It.IsAny()))
        .returns();

    repository = new Mock<LoFileRepository>();
    container.bind(LoFileRepository).toConstantValue(repository.object());
    repository.setup(instance => instance.findById(existingFile.id))
        .returns(Promise.resolve(existingEntity.object()));
    repository.setup(instance => instance.findById(newFile.id))
        .returns(Promise.resolve(undefined))
    repository.setup(instance => instance.save(It.IsAny<LoFileAggregateRoot>()))
        .returns(Promise.resolve())

    const newEntity = new Mock<LoFileAggregateRoot>()
    factory.setup(instance => instance.newLoFile(newFile))
        .returns(newEntity.object())
}
