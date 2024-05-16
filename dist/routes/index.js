"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const http_status_codes_1 = require("http-status-codes");
const router = express_1.default.Router();
// Set Data
router.post("/set-data", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, name, data } = req.body;
    if (id && data) {
        try {
            const existingRecord = yield models_1.Store.findOne({
                where: {
                    id,
                    name,
                },
                order: [["createdAt", "DESC"]],
            });
            let dataCreated;
            let version;
            if (existingRecord) {
                const length = Object.keys(existingRecord.data).length;
                dataCreated = yield existingRecord.update({
                    data: Object.assign(Object.assign({}, existingRecord.data), { [`${length + 1}`]: data }),
                });
                version = length + 1;
            }
            else {
                dataCreated = yield models_1.Store.create({ id, name, data: { ["1"]: data } });
                version = 1;
            }
            console.log(dataCreated);
            res.status(http_status_codes_1.StatusCodes.OK).json({ version });
        }
        catch (error) {
            console.error("Error adding data:", error);
            res
                .status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR)
                .json({ message: "An error occurred while adding data" });
        }
    }
    else {
        res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({ message: "Incomplete fields" });
    }
}));
// Get Data
router.post("/get-data", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, name, version } = req.body;
    try {
        if (!id || !name) {
            return res
                .status(http_status_codes_1.StatusCodes.BAD_REQUEST)
                .json({ message: "Incomplete fields" });
        }
        const existingRecord = yield models_1.Store.findOne({
            where: { id, name },
            order: [["createdAt", "DESC"]],
        });
        if (!existingRecord) {
            return res
                .status(http_status_codes_1.StatusCodes.NOT_FOUND)
                .json({ message: "Record not found" });
        }
        const data = existingRecord.dataValues.data;
        let dataToSend;
        if (version) {
            const lowerCaseVersion = String(version).toLowerCase();
            if (!data[lowerCaseVersion]) {
                return res
                    .status(http_status_codes_1.StatusCodes.NOT_FOUND)
                    .json({ message: `Version ${version} not found` });
            }
            dataToSend = data[lowerCaseVersion];
        }
        else {
            const latestVersion = Object.keys(data).sort().pop();
            dataToSend = data[latestVersion];
        }
        res.status(http_status_codes_1.StatusCodes.OK).json(dataToSend);
    }
    catch (error) {
        console.error("Error retrieving data:", error);
        res
            .status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ message: "An error occurred while retrieving data" });
    }
}));
exports.default = router;
//# sourceMappingURL=index.js.map