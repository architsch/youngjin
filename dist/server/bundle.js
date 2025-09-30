/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/server/db/authDB.ts":
/*!*********************************!*\
  !*** ./src/server/db/authDB.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _db__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./db */ "./src/server/db/db.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var AuthDB = {
    registerNewUser: function (userName, passwordHash, email, res) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("INSERT INTO users (userName, userType, passwordHash, email) VALUES (?, ?, ?, ?);", [userName, "member", passwordHash, email]).run(res, "AuthDB.registerNewUser")];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AuthDB);


/***/ }),

/***/ "./src/server/db/db.ts":
/*!*****************************!*\
  !*** ./src/server/db/db.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mysql2_promise__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mysql2/promise */ "mysql2/promise");
/* harmony import */ var mysql2_promise__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mysql2_promise__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _util_debugUtil__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _types_query__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./types/query */ "./src/server/db/types/query.ts");
/* harmony import */ var _types_transaction__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./types/transaction */ "./src/server/db/types/transaction.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};






dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var dev = process.env.MODE == "dev";
var pool = undefined;
var DB = {
    createPool: function () {
        if (pool) {
            _util_debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].logRaw("DB connection pool is already created.", "high", "pink");
            return;
        }
        pool = mysql2_promise__WEBPACK_IMPORTED_MODULE_0___default().createPool({
            host: dev ? process.env.SQL_HOST_DEV : process.env.SQL_HOST_PROD,
            user: dev ? process.env.SQL_USER_DEV : process.env.SQL_USER_PROD,
            password: dev ? process.env.SQL_PASS_DEV : process.env.SQL_PASS_PROD,
            database: "main",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
        if (!pool) {
            _util_debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].logRaw("Failed to create a DB connection pool.", "high", "pink");
            return;
        }
    },
    makeQuery: function (queryStr, queryParams) {
        if (!pool)
            DB.createPool();
        return new _types_query__WEBPACK_IMPORTED_MODULE_4__["default"](pool, queryStr, queryParams);
    },
    makeTransaction: function (queries) {
        return new _types_transaction__WEBPACK_IMPORTED_MODULE_5__["default"](pool, queries);
    },
    runSQLFile: function (fileName) { return __awaiter(void 0, void 0, void 0, function () {
        var sql, sqlStatements, conn, _i, sqlStatements_1, sqlStatement, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _util_debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].log("Opening SQL File", { fileName: fileName }, "high");
                    return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_1__["default"].read(fileName, "sql")];
                case 1:
                    sql = _a.sent();
                    sqlStatements = sql.split(";").map(function (x) { return x.trim() + ";"; }).filter(function (x) { return x.length > 1; });
                    conn = undefined;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 8, 9, 10]);
                    return [4 /*yield*/, mysql2_promise__WEBPACK_IMPORTED_MODULE_0___default().createConnection({
                            host: dev ? process.env.SQL_HOST_DEV : process.env.SQL_HOST_PROD,
                            user: dev ? process.env.SQL_USER_DEV : process.env.SQL_USER_PROD,
                            password: dev ? process.env.SQL_PASS_DEV : process.env.SQL_PASS_PROD,
                        })];
                case 3:
                    conn = _a.sent();
                    conn === null || conn === void 0 ? void 0 : conn.connect();
                    _i = 0, sqlStatements_1 = sqlStatements;
                    _a.label = 4;
                case 4:
                    if (!(_i < sqlStatements_1.length)) return [3 /*break*/, 7];
                    sqlStatement = sqlStatements_1[_i];
                    return [4 /*yield*/, (conn === null || conn === void 0 ? void 0 : conn.query(sqlStatement))];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 10];
                case 8:
                    err_1 = _a.sent();
                    _util_debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].log("SQL File Execution Error", { err: err_1 }, "high", "pink");
                    return [3 /*break*/, 10];
                case 9:
                    conn === null || conn === void 0 ? void 0 : conn.end();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    }); },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DB);


/***/ }),

/***/ "./src/server/db/emailDB.ts":
/*!**********************************!*\
  !*** ./src/server/db/emailDB.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _db__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./db */ "./src/server/db/db.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var EmailDB = {
    verifications: {
        selectByEmail: function (email, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT * FROM emailVerifications WHERE email = ?;", [email]).run(res, "EmailDB.verifications.selectByEmail")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        insert: function (email, verificationCode, expirationTime, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("INSERT INTO emailVerifications (email, verificationCode, expirationTime) VALUES (?, ?, ?);", [email, verificationCode, expirationTime.toString()]).run(res, "EmailDB.verifications.insert")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        updateExpirationTime: function (email, newExpirationTime, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("UPDATE emailVerifications SET expirationTime = ? WHERE email = ?;", [newExpirationTime.toString(), email]).run(res, "EmailDB.verifications.updateExpirationTime")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        deleteExpired: function (currTime, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("DELETE FROM emailVerifications WHERE expirationTime < ?;", [currTime.toString()]).run(res, "EmailDB.verifications.deleteExpired")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmailDB);


/***/ }),

/***/ "./src/server/db/searchDB.ts":
/*!***********************************!*\
  !*** ./src/server/db/searchDB.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _db__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./db */ "./src/server/db/db.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var searchRoomsAssociatedWithUser = function (userStatusesToInclude, page) {
    var limit = 10;
    var condsStr = " AND (".concat(userStatusesToInclude.map(function (x) { return "roomMemberships.userStatus = '".concat(x, "'"); }).join(" OR "), ")");
    return "SELECT rooms.roomID AS roomID, rooms.roomName AS roomName, roomMemberships.userStatus as userStatus, rooms.ownerUserName as ownerUserName\n    FROM rooms INNER JOIN roomMemberships ON roomMemberships.roomID = rooms.roomID\n    WHERE roomMemberships.userID = ?".concat(userStatusesToInclude.length > 0 ? condsStr : "", "\n    ORDER BY rooms.roomID DESC LIMIT ").concat(limit, ", ").concat(page * limit, ";");
};
var searchUsersAssociatedWithRoom = function (userStatusesToInclude, page) {
    var limit = 10;
    var condsStr = " AND (".concat(userStatusesToInclude.map(function (x) { return "roomMemberships.userStatus = '".concat(x, "'"); }).join(" OR "), ")");
    return "SELECT users.userID as userID, users.userName AS userName, roomMemberships.userStatus as userStatus\n    FROM users INNER JOIN roomMemberships ON roomMemberships.userID = users.userID\n    WHERE roomMemberships.roomID = ?".concat(userStatusesToInclude.length > 0 ? condsStr : "", "\n    ORDER BY users.userID DESC LIMIT ").concat(limit, ", ").concat(page * limit, ";");
};
var SearchDB = {
    rooms: {
        withRoomName: function (roomName, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT * FROM rooms WHERE roomName = ?;", [roomName])
                            .run(res, "SearchDB.rooms.withRoomName")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichIOwn: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser(["owner"], page), [userID])
                            .run(res, "SearchDB.rooms.whichIOwn")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichIJoined: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser(["member"], page), [userID])
                            .run(res, "SearchDB.rooms.whichIJoined")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichInvitedMe: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser(["invited"], page), [userID])
                            .run(res, "SearchDB.rooms.whichInvitedMe")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichIRequestedToJoin: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser(["requested"], page), [userID])
                            .run(res, "SearchDB.rooms.whichIRequestedToJoin")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichIAmPendingToJoin: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser(["invited", "requested"], page), [userID])
                            .run(res, "SearchDB.rooms.whichIAmPendingToJoin")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whichIAmAssociatedWith: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchRoomsAssociatedWithUser([], page), [userID])
                            .run(res, "SearchDB.rooms.whichIAmAssociatedWith")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        others: function (userID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            var limit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = 10;
                        return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT roomID, roomName FROM rooms\n                WHERE NOT EXISTS (SELECT roomID FROM roomMemberships WHERE userID = ".concat(userID, " LIMIT 1)\n                ORDER BY roomID DESC LIMIT ").concat(limit, ", ").concat(page * limit, ";"), undefined).run(res, "SearchDB.rooms.others")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
    },
    users: {
        withUserName: function (userName, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT * FROM users WHERE userName = ?;", [userName])
                            .run(res, "SearchDB.users.withUserName")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        withEmail: function (email, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT * FROM users WHERE email = ?;", [email])
                            .run(res, "SearchDB.users.withEmail")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whoJoinedRoom: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchUsersAssociatedWithRoom(["member"], page), [roomID])
                            .run(res, "SearchDB.users.whoJoinedRoom")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whoAreInvitedToJoinRoom: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchUsersAssociatedWithRoom(["invited"], page), [roomID])
                            .run(res, "SearchDB.users.whoAreInvitedToJoinRoom")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whoRequestedToJoinRoom: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchUsersAssociatedWithRoom(["requested"], page), [roomID])
                            .run(res, "SearchDB.users.whoRequestedToJoinRoom")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whoArePendingToJoinRoom: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchUsersAssociatedWithRoom(["invited", "requested"], page), [roomID])
                            .run(res, "SearchDB.users.whoArePendingToJoinRoom")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        whoAreAssociatedWithRoom: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery(searchUsersAssociatedWithRoom([], page), [roomID])
                            .run(res, "SearchDB.users.whoAreAssociatedWithRoom")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        others: function (roomID, page, res) { return __awaiter(void 0, void 0, void 0, function () {
            var limit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = 10;
                        return [4 /*yield*/, _db__WEBPACK_IMPORTED_MODULE_0__["default"].makeQuery("SELECT userID, userName FROM users\n                WHERE NOT EXISTS (SELECT userID FROM roomMemberships WHERE roomID = ".concat(roomID, " LIMIT 1)\n                ORDER BY userID DESC LIMIT ").concat(limit, ", ").concat(page * limit, ";"), undefined).run(res, "SearchDB.users.others")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchDB);


/***/ }),

/***/ "./src/server/db/types/query.ts":
/*!**************************************!*\
  !*** ./src/server/db/types/query.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/debugUtil */ "./src/server/util/debugUtil.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};

var Query = /** @class */ (function () {
    function Query(pool, queryStr, queryParams) {
        this.pool = pool;
        this.queryStr = queryStr;
        this.queryParams = queryParams;
    }
    Query.prototype.run = function (res, stackTraceName) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, result, fields, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].pushStackTrace(stackTraceName);
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Query Started", { queryStr: this.queryStr, queryParams: this.queryParams }, "low");
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.pool.query(this.queryStr, this.queryParams)];
                    case 2:
                        _a = _b.sent(), result = _a[0], fields = _a[1];
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Query Succeeded", { queryStr: this.queryStr, queryParams: this.queryParams }, "medium");
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].popStackTrace(stackTraceName);
                        res === null || res === void 0 ? void 0 : res.status(202);
                        return [2 /*return*/, result];
                    case 3:
                        err_1 = _b.sent();
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Query Error", { err: err_1 }, "high", "pink");
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].popStackTrace(stackTraceName);
                        res === null || res === void 0 ? void 0 : res.status(500).send(err_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return Query;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Query);


/***/ }),

/***/ "./src/server/db/types/transaction.ts":
/*!********************************************!*\
  !*** ./src/server/db/types/transaction.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/debugUtil */ "./src/server/util/debugUtil.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};

var Transaction = /** @class */ (function () {
    function Transaction(pool, queries) {
        this.pool = pool;
        this.queries = queries;
    }
    Transaction.prototype.run = function (res, stackTraceName) {
        return __awaiter(this, void 0, void 0, function () {
            var conn, success, count, _i, _a, query, _b, result, fields, err_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].pushStackTrace(stackTraceName);
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Transaction Began", { numQueries: this.queries.length }, "low");
                        conn = undefined;
                        success = false;
                        count = 0;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 11, 13, 14]);
                        return [4 /*yield*/, this.pool.getConnection()];
                    case 2:
                        conn = _c.sent();
                        return [4 /*yield*/, conn.beginTransaction()];
                    case 3:
                        _c.sent();
                        _i = 0, _a = this.queries;
                        _c.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3 /*break*/, 9];
                        query = _a[_i];
                        count++;
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Transaction Query Started", { progress: "".concat(count, "/").concat(this.queries.length), query: query }, "low");
                        return [4 /*yield*/, (conn === null || conn === void 0 ? void 0 : conn.query(query.queryStr, query.queryParams))];
                    case 5:
                        _b = _c.sent(), result = _b[0], fields = _b[1];
                        if (!(result.affectedRows == 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, (conn === null || conn === void 0 ? void 0 : conn.rollback())];
                    case 6:
                        _c.sent();
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Transaction Query Made No Change", { progress: "".concat(count, "/").concat(this.queries.length), query: query }, "high");
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].popStackTrace(stackTraceName);
                        res === null || res === void 0 ? void 0 : res.status(403);
                        return [2 /*return*/];
                    case 7:
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Transaction Query Succeeded", { progress: "".concat(count, "/").concat(this.queries.length), query: query }, "low");
                        _c.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 4];
                    case 9: return [4 /*yield*/, (conn === null || conn === void 0 ? void 0 : conn.commit())];
                    case 10:
                        _c.sent();
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].logRaw("SQL Transaction Committed", "medium");
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].popStackTrace(stackTraceName);
                        success = true;
                        return [3 /*break*/, 14];
                    case 11:
                        err_1 = _c.sent();
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("SQL Transaction Error", { progress: "".concat(count, "/").concat(this.queries.length), err: err_1 }, "high", "pink");
                        return [4 /*yield*/, (conn === null || conn === void 0 ? void 0 : conn.rollback())];
                    case 12:
                        _c.sent();
                        if (stackTraceName)
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].popStackTrace(stackTraceName);
                        res === null || res === void 0 ? void 0 : res.status(500).send(err_1);
                        return [3 /*break*/, 14];
                    case 13:
                        conn === null || conn === void 0 ? void 0 : conn.release();
                        if (success)
                            res === null || res === void 0 ? void 0 : res.status(202);
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    ;
    return Transaction;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Transaction);


/***/ }),

/***/ "./src/server/router/api/authRouter.ts":
/*!*********************************************!*\
  !*** ./src/server/router/api/authRouter.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_authUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/authUtil */ "./src/server/util/authUtil.ts");
/* harmony import */ var _util_networkUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/networkUtil */ "./src/server/util/networkUtil.ts");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! express */ "express");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(express__WEBPACK_IMPORTED_MODULE_2__);

//import EmailUtil from "../../util/emailUtil";


var AuthRouter = express__WEBPACK_IMPORTED_MODULE_2___default().Router();
/*
// req.body = {userName, password, email, verificationCode}
AuthRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
    await AuthUtil.register(req, res);
    NetworkUtil.onRouteResponse(res);
});

// req.body = {email}
AuthRouter.post("/vemail", async (req: Request, res: Response): Promise<void> => {
    await EmailUtil.startEmailVerification(req, res);
    NetworkUtil.onRouteResponse(res);
});

// req.body = {userName, password}
AuthRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
    await AuthUtil.login(req, res);
    NetworkUtil.onRouteResponse(res);
});
*/
AuthRouter.get("/clear-token", function (req, res) {
    _util_authUtil__WEBPACK_IMPORTED_MODULE_0__["default"].clearToken(req, res);
    _util_networkUtil__WEBPACK_IMPORTED_MODULE_1__["default"].onRouteResponse(res);
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AuthRouter);


/***/ }),

/***/ "./src/server/router/router.ts":
/*!*************************************!*\
  !*** ./src/server/router/router.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Router)
/* harmony export */ });
/* harmony import */ var _ui_pageRouter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ui/pageRouter */ "./src/server/router/ui/pageRouter.ts");
/* harmony import */ var _api_authRouter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api/authRouter */ "./src/server/router/api/authRouter.ts");
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


//import RoomRouter from "./api/roomRouter";
//import AdminRouter from "./api/adminRouter";
//import SearchRouter from "./api/searchRouter";


function Router(app) {
    var _this = this;
    // If you are in dev mode, also emulate the behavior of the static web server.
    if (process.env.MODE == "dev") {
        app.get("/", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            var staticContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_2__["default"].read(req.url + "index.html")];
                    case 1:
                        staticContent = _a.sent();
                        res.status(200).setHeader("content-type", "text/html")
                            .send(_util_ejsUtil__WEBPACK_IMPORTED_MODULE_3__["default"].postProcessHTML(staticContent));
                        return [2 /*return*/];
                }
            });
        }); });
        app.get(/.*\.html$/, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            var staticContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_2__["default"].read(req.url)];
                    case 1:
                        staticContent = _a.sent();
                        res.status(200).setHeader("content-type", "text/html")
                            .send(_util_ejsUtil__WEBPACK_IMPORTED_MODULE_3__["default"].postProcessHTML(staticContent));
                        return [2 /*return*/];
                }
            });
        }); });
        app.get(/.*\.js$/, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                res.status(200).setHeader("content-type", "text/javascript")
                    .sendFile(_util_fileUtil__WEBPACK_IMPORTED_MODULE_2__["default"].getAbsoluteFilePath(req.url));
                return [2 /*return*/];
            });
        }); });
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.pdf)$/, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                res.sendFile(_util_fileUtil__WEBPACK_IMPORTED_MODULE_2__["default"].getAbsoluteFilePath(req.url));
                return [2 /*return*/];
            });
        }); });
    }
    app.use("/api/auth", _api_authRouter__WEBPACK_IMPORTED_MODULE_1__["default"]);
    //app.use("/api/search", SearchRouter);
    //app.use("/api/room", RoomRouter);
    //app.use("/api/admin", AdminRouter);
    app.use("/", _ui_pageRouter__WEBPACK_IMPORTED_MODULE_0__["default"]);
}


/***/ }),

/***/ "./src/server/router/ui/pageRouter.ts":
/*!********************************************!*\
  !*** ./src/server/router/ui/pageRouter.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_authUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/authUtil */ "./src/server/util/authUtil.ts");
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! express */ "express");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(express__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _ssg_data_arcadeData__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../ssg/data/arcadeData */ "./src/server/ssg/data/arcadeData.ts");





dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var PageRouter = express__WEBPACK_IMPORTED_MODULE_2___default().Router();
PageRouter.get("/mypage", _util_authUtil__WEBPACK_IMPORTED_MODULE_0__["default"].authenticateAnyUser, function (req, res) {
    _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/dynamic/mypage", {
        loginDestination: "".concat(process.env.URL_DYNAMIC, "/mypage"),
    });
});
PageRouter.get("/register", function (req, res) {
    _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/dynamic/register", {
        registerDestination: "".concat(process.env.URL_DYNAMIC, "/mypage"),
    });
});
PageRouter.get("/login", function (req, res) {
    _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/dynamic/login", {
        loginDestination: "".concat(process.env.URL_DYNAMIC, "/mypage"),
    });
});
if (process.env.MODE == "dev") {
    PageRouter.get("/admin", function (req, res) {
        _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/development/admin", {});
    });
    PageRouter.get("/console", function (req, res) {
        _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/development/console", {});
    });
    PageRouter.get("/test-ui", function (req, res) {
        _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/development/test_ui", {
            gameEntries: _ssg_data_arcadeData__WEBPACK_IMPORTED_MODULE_4__.ArcadeData.gameEntries
        });
    });
}
else {
    PageRouter.get("/admin", _util_authUtil__WEBPACK_IMPORTED_MODULE_0__["default"].authenticateAdmin, function (req, res) {
        _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/development/admin", {});
    });
    PageRouter.get("/console", _util_authUtil__WEBPACK_IMPORTED_MODULE_0__["default"].authenticateAdmin, function (req, res) {
        _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].render(req, res, "page/development/console", {});
    });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageRouter);


/***/ }),

/***/ "./src/server/sockets/consoleSockets.ts":
/*!**********************************************!*\
  !*** ./src/server/sockets/consoleSockets.ts ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var _db_db__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../db/db */ "./src/server/db/db.ts");


var nsp;
var col1 = "<td style=\"color: #e0e020; background-color: #202090;\">";
var col2 = "<td style=\"color: #20e020; background-color: #101010;\">";
var col3 = "<td style=\"color: #303030; background-color: #c0c0c0;\">";
var end = "</td>";
var row = function (txt1, txt2, txt3) {
    return "".concat(col1).concat(txt1).concat(end).concat(col2).concat(txt2).concat(end).concat(col3).concat(txt3).concat(end);
};
var ConsoleSockets = {
    init: function (io, authMiddleware) {
        nsp = io.of("/console_sockets");
        nsp.use(authMiddleware);
        nsp.on("connection", function (socket) {
            console.log("(ConsoleSockets) Client connected :: ".concat(JSON.stringify(socket.handshake.auth)));
            socket.on("command", function (command) {
                console.log("(ConsoleSockets) Command received :: [".concat(command, "] - sent by :: ").concat(JSON.stringify(socket.handshake.auth.user)));
                var words = command.split(" ");
                switch (words[0]) {
                    case "print":
                        words.shift();
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].logRaw((words.length == 0) ? "-" : words.join(" "), "high");
                        break;
                    case "db":
                        if (process.env.MODE == "dev") {
                            words.shift();
                            _db_db__WEBPACK_IMPORTED_MODULE_1__["default"].runSQLFile("".concat(words[0], ".sql"));
                        }
                        else
                            _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].logRaw("Command \"".concat(words[0], "\" is supported only in dev mode."), "high", "pink");
                        break;
                    case "reboot":
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].logRaw("Rebooting...", "high");
                        process.exit(0);
                        break;
                    default:
                        _util_debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].logRaw("Unknown command \"".concat(words[0], "\"."), "high", "pink");
                        break;
                }
            });
            socket.on("disconnect", function () {
                console.log("(ConsoleSockets) Client disconnected :: ".concat(JSON.stringify(socket.handshake.auth)));
            });
        });
    },
    log: function (message, origin, details) {
        if (nsp)
            nsp.emit("log", row(message, origin, details));
        else
            console.log("".concat(message, "\n(ORIGIN: ").concat(origin, ")\n(DETAILS: ").concat(details, ")"));
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConsoleSockets);


/***/ }),

/***/ "./src/server/sockets/gameSockets.ts":
/*!*******************************************!*\
  !*** ./src/server/sockets/gameSockets.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var nsp;
var objectRecords = {};
var GameSockets = {
    init: function (io, authMiddleware) {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);
        nsp.on("connection", function (socket) {
            var user = socket.handshake.auth;
            console.log("(GameSockets) Client connected :: ".concat(JSON.stringify(user)));
            socket.on("message", function (params) {
                nsp.to("room_default").emit("message", params);
            });
            socket.on("objectSync", function (params) {
                var objectRecord = objectRecords[params.objectId];
                if (objectRecord == undefined) {
                    console.error("Tried to sync a nonexistent object :: ".concat(JSON.stringify(params)));
                    return;
                }
                Object.assign(objectRecord.transform, params.transform);
                nsp.to("room_default").emit("objectSync", params);
            });
            socket.on("objectSpawn", function (params) {
                var object = objectRecords[params.objectId];
                if (object != undefined) {
                    console.error("Tried to spawn an already existing object :: ".concat(JSON.stringify(params)));
                    return;
                }
                var transformCopy = {};
                Object.assign(transformCopy, params.transform);
                objectRecords[params.objectId] = {
                    objectType: params.objectType,
                    objectId: params.objectId,
                    transform: transformCopy,
                };
                nsp.to("room_default").emit("objectSpawn", params);
            });
            socket.on("objectDespawn", function (params) {
                var object = objectRecords[params.objectId];
                if (object == undefined) {
                    console.error("Tried to despawn a nonexistent object :: ".concat(JSON.stringify(params)));
                    return;
                }
                delete objectRecords[params.objectId];
                nsp.to("room_default").emit("objectDespawn", params);
            });
            socket.on("disconnect", function () {
                console.log("(GameSockets) Client disconnected :: ".concat(JSON.stringify(user)));
                var despawnPendingObjectIds = [];
                for (var _i = 0, _a = Object.values(objectRecords); _i < _a.length; _i++) {
                    var objectRecord = _a[_i];
                    if (objectRecord.objectId.startsWith(user.userName)) {
                        console.log("Despawned :: ".concat(objectRecord.objectId));
                        despawnPendingObjectIds.push(objectRecord.objectId);
                    }
                }
                for (var _b = 0, despawnPendingObjectIds_1 = despawnPendingObjectIds; _b < despawnPendingObjectIds_1.length; _b++) {
                    var objectId = despawnPendingObjectIds_1[_b];
                    if (objectRecords[objectId] != undefined)
                        delete objectRecords[objectId];
                    nsp.to("room_default").emit("objectDespawn", { objectId: objectId });
                }
            });
            socket.join("room_default");
            socket.emit("worldSync", { objectRecords: objectRecords });
        });
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GameSockets);


/***/ }),

/***/ "./src/server/sockets/sockets.ts":
/*!***************************************!*\
  !*** ./src/server/sockets/sockets.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Sockets)
/* harmony export */ });
/* harmony import */ var socket_io__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! socket.io */ "socket.io");
/* harmony import */ var socket_io__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(socket_io__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _consoleSockets__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./consoleSockets */ "./src/server/sockets/consoleSockets.ts");
/* harmony import */ var _gameSockets__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./gameSockets */ "./src/server/sockets/gameSockets.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _util_authUtil__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../util/authUtil */ "./src/server/util/authUtil.ts");
/* harmony import */ var _util_networkUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../util/networkUtil */ "./src/server/util/networkUtil.ts");
/* harmony import */ var cookie__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! cookie */ "cookie");
/* harmony import */ var cookie__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(cookie__WEBPACK_IMPORTED_MODULE_6__);







dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var connectedUserNames = new Set();
function Sockets(server) {
    var io = new (socket_io__WEBPACK_IMPORTED_MODULE_0___default().Server)(server);
    _consoleSockets__WEBPACK_IMPORTED_MODULE_1__["default"].init(io, (process.env.MODE == "dev")
        ? function (_, next) { return next(); } // Don't authenticate in dev mode
        : makeAuthMiddleware(function (user) { return user.userType == "admin"; }));
    _gameSockets__WEBPACK_IMPORTED_MODULE_2__["default"].init(io, makeAuthMiddleware(function (user) { return true; }));
}
function makeAuthMiddleware(passCondition) {
    return function (socket, next) {
        var cookieStr = socket.request.headers.cookie;
        console.log("Authenticating socket (ID: ".concat(socket.id, ")"));
        if (!cookieStr) {
            next(new Error(_util_networkUtil__WEBPACK_IMPORTED_MODULE_5__["default"].getErrorPageURL("auth-failure")));
            return;
        }
        var cookieMap = cookie__WEBPACK_IMPORTED_MODULE_6__.parse(cookieStr);
        var token = cookieMap["thingspool_token"];
        if (!token) {
            next(new Error(_util_networkUtil__WEBPACK_IMPORTED_MODULE_5__["default"].getErrorPageURL("auth-failure")));
            return;
        }
        var user = _util_authUtil__WEBPACK_IMPORTED_MODULE_4__["default"].getUserFromToken(token);
        if (!user) {
            next(new Error(_util_networkUtil__WEBPACK_IMPORTED_MODULE_5__["default"].getErrorPageURL("auth-failure")));
            return;
        }
        if (connectedUserNames.has(user.userName)) {
            next(new Error(_util_networkUtil__WEBPACK_IMPORTED_MODULE_5__["default"].getErrorPageURL("auth-duplication")));
            return;
        }
        if (!passCondition(user)) {
            next(new Error(_util_networkUtil__WEBPACK_IMPORTED_MODULE_5__["default"].getErrorPageURL("auth-no-permission")));
            return;
        }
        connectedUserNames.add(user.userName);
        socket.on("disconnect", function () {
            if (!connectedUserNames.has(user.userName)) {
                console.error("User \"".concat(user.userName, "\" is already disconnected."));
                return;
            }
            connectedUserNames.delete(user.userName);
        });
        socket.handshake.auth = user;
        next();
    };
}


/***/ }),

/***/ "./src/server/ssg/builder/atomFeedBuilder.ts":
/*!***************************************************!*\
  !*** ./src/server/ssg/builder/atomFeedBuilder.ts ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var AtomFeedBuilder = /** @class */ (function () {
    function AtomFeedBuilder() {
        this.lines = ["</feed>"];
        this.globalLatestUpdate = new Date(process.env.GLOBAL_LAST_MOD);
    }
    AtomFeedBuilder.prototype.addEntry = function (url, title, lastmod, description) {
        var date = new Date(lastmod);
        if (date > this.globalLatestUpdate)
            this.globalLatestUpdate = date;
        this.lines.push("</entry>");
        this.lines.push("  <summary>".concat(description, "</summary>"));
        this.lines.push("  <updated>".concat(date.toISOString(), "</updated>"));
        this.lines.push("  <id>".concat(url, "</id>")); // not ideal to use the url as unique never changing id but there is no other id for each article.
        this.lines.push("  <link href=\"".concat(url, "\"/>"));
        this.lines.push("  <title>".concat(title, "</title>"));
        this.lines.push("<entry>");
    };
    AtomFeedBuilder.prototype.build = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.lines.push("<id>urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c</id>"); // uuid randomly generated
                        this.lines.push("</author>");
                        this.lines.push("  <name>Youngjin Kang</name>");
                        this.lines.push("<author>");
                        this.lines.push("<updated>".concat(this.globalLatestUpdate.toISOString(), "</updated>"));
                        this.lines.push("<link href=\"".concat(process.env.URL_STATIC, "\"/>"));
                        this.lines.push("<link rel=\"self\" type=\"application/atom+xml\" href=\"".concat(process.env.URL_STATIC, "/feed.atom\"/>"));
                        this.lines.push("<title>ThingsPool</title>");
                        this.lines.push("<feed xmlns=\"http://www.w3.org/2005/Atom\">");
                        this.lines.push("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
                        this.lines.reverse();
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].write("feed.atom", this.lines.join("\n"))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return AtomFeedBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AtomFeedBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/embeddedScriptBuilder.ts":
/*!*********************************************************!*\
  !*** ./src/server/ssg/builder/embeddedScriptBuilder.ts ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var EmbeddedScriptBuilder = /** @class */ (function () {
    function EmbeddedScriptBuilder() {
    }
    EmbeddedScriptBuilder.prototype.build = function (sourceDir, targetDir) {
        return __awaiter(this, void 0, void 0, function () {
            var relativeFilePaths, _i, relativeFilePaths_1, relativeFilePath, sourceCode;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (sourceDir == undefined)
                            sourceDir = "".concat(process.env.SRC_ROOT_DIR, "/shared/embeddedScripts");
                        if (targetDir == undefined)
                            targetDir = "".concat(process.env.VIEWS_ROOT_DIR, "/partial/embeddedScript");
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].getAllRelativePathsInDirRecursively(sourceDir)];
                    case 1:
                        relativeFilePaths = _a.sent();
                        relativeFilePaths = relativeFilePaths.filter(function (x) { return x.endsWith(".js"); });
                        _i = 0, relativeFilePaths_1 = relativeFilePaths;
                        _a.label = 2;
                    case 2:
                        if (!(_i < relativeFilePaths_1.length)) return [3 /*break*/, 6];
                        relativeFilePath = relativeFilePaths_1[_i];
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].read(relativeFilePath, sourceDir)];
                    case 3:
                        sourceCode = (_a.sent())
                            .split("\n")
                            .filter(function (line) { return !line.startsWith("export "); }) // Remove 'export' statements.
                            .join("\n").trim();
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].write(relativeFilePath.replace(".js", ".ejs"), "\n<%_ if (!locals.globalDictionary[\"script_included_(".concat(relativeFilePath, ")\"]) { _%>\n<!-- NOTE: This EJS partial is auto-generated by 'embeddedScriptBuilder.ts' -->\n<%_ locals.globalDictionary[\"script_included_(").concat(relativeFilePath, ")\"] = true; _%>\n<script>\n").concat(sourceCode, "\n</script>\n<%_ } _%>\n").trim(), targetDir)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return EmbeddedScriptBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmbeddedScriptBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/arcadeGamePageBuilder.ts":
/*!**************************************************************!*\
  !*** ./src/server/ssg/builder/page/arcadeGamePageBuilder.ts ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var ArcadeGamePageBuilder = /** @class */ (function () {
    function ArcadeGamePageBuilder(sitemapBuilder, atomFeedBuilder) {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    ArcadeGamePageBuilder.prototype.build = function (entry) {
        return __awaiter(this, void 0, void 0, function () {
            var relativeURL, rawText, lines, playLinkImagePath, description, keywords, contentLines, imageIndex, paragraphLinesPending, endParagraph, i, line, paragraphTitle, imgName, imgPath, builder, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        relativeURL = "".concat(entry.dirName, "/page.html");
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].read("".concat(entry.dirName, "/source.txt"))];
                    case 1:
                        rawText = _c.sent();
                        lines = rawText.split(/\r?\n/);
                        playLinkImagePath = (entry.playLinkImagePathOverride == undefined) ? "play.png" : entry.playLinkImagePathOverride;
                        description = "";
                        keywords = "";
                        if (lines[0].startsWith(":d:"))
                            description = lines[0].substring(3);
                        else
                            console.error(":d: is missing in -> " + entry.title);
                        if (lines[1].startsWith(":k:"))
                            keywords = lines[1].substring(3).toLowerCase().replaceAll("-", " ");
                        else
                            console.error(":k: is missing in -> " + entry.title);
                        contentLines = [];
                        imageIndex = 1;
                        paragraphLinesPending = [];
                        endParagraph = function () {
                            if (paragraphLinesPending.length > 0) {
                                contentLines.push("<p>".concat(paragraphLinesPending.join("<br>"), "</p>"));
                                paragraphLinesPending.length = 0;
                            }
                        };
                        for (i = 2; i < lines.length; ++i) {
                            line = lines[i];
                            line = line.trim();
                            if (line.length == 0) // empty line
                             {
                                endParagraph();
                            }
                            else if (line.startsWith("[")) // Paragraph Title
                             {
                                endParagraph();
                                paragraphTitle = line.match(/\[(.*?)\]/)[1].trim();
                                if (paragraphTitle.length > 0) {
                                    contentLines.push("<h2>".concat(paragraphTitle, "</h2>"));
                                }
                            }
                            else if (line.startsWith("<")) // image reference
                             {
                                endParagraph();
                                imgName = line.match(/<(.*?)>/)[1];
                                if (imgName.length > 0) {
                                    imgPath = "".concat(process.env.URL_STATIC, "/").concat(entry.dirName, "/").concat(imgName, ".jpg");
                                    contentLines.push("<img class=\"l_image\" src=\"".concat(imgPath, "\" alt=\"ThingsPool - ").concat(entry.title, " (Screenshot ").concat(imageIndex++, ")\">"));
                                }
                            }
                            else // plain text
                             {
                                line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
                                paragraphLinesPending.push(line);
                            }
                        }
                        endParagraph();
                        if (entry.videoTag != null && entry.videoTag != undefined) {
                            contentLines.push(entry.videoTag);
                        }
                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__["default"]();
                        _b = (_a = builder).addLine;
                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/arcadeGame.ejs", {
                                entry: entry,
                                relativeURL: relativeURL,
                                description: description,
                                keywords: keywords,
                                playLinkImagePath: playLinkImagePath,
                                content: contentLines.join("\n")
                            })];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        this.sitemapBuilder.addEntry(relativeURL, entry.lastmod);
                        this.atomFeedBuilder.addEntry("".concat(process.env.URL_STATIC, "/").concat(relativeURL), entry.title, entry.lastmod, entry.title);
                        return [4 /*yield*/, builder.build(relativeURL)];
                    case 3:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    return ArcadeGamePageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ArcadeGamePageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/arcadePageBuilder.ts":
/*!**********************************************************!*\
  !*** ./src/server/ssg/builder/page/arcadePageBuilder.ts ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var _arcadeGamePageBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./arcadeGamePageBuilder */ "./src/server/ssg/builder/page/arcadeGamePageBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _data_arcadeData__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../data/arcadeData */ "./src/server/ssg/data/arcadeData.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};





dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var ArcadePageBuilder = /** @class */ (function () {
    function ArcadePageBuilder(sitemapBuilder, atomFeedBuilder) {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    ArcadePageBuilder.prototype.build = function () {
        return __awaiter(this, void 0, void 0, function () {
            var builder, _a, _b, _i, _c, entry;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__["default"]();
                        _b = (_a = builder).addLine;
                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__["default"].createStaticHTMLFromEJS("page/static/arcade.ejs", {
                                entries: _data_arcadeData__WEBPACK_IMPORTED_MODULE_4__.ArcadeData.gameEntries,
                            })];
                    case 1:
                        _b.apply(_a, [_d.sent()]);
                        return [4 /*yield*/, builder.build("arcade.html")];
                    case 2:
                        _d.sent();
                        this.sitemapBuilder.addEntry("arcade.html", "2025-02-28");
                        _i = 0, _c = _data_arcadeData__WEBPACK_IMPORTED_MODULE_4__.ArcadeData.gameEntries;
                        _d.label = 3;
                    case 3:
                        if (!(_i < _c.length)) return [3 /*break*/, 6];
                        entry = _c[_i];
                        return [4 /*yield*/, new _arcadeGamePageBuilder__WEBPACK_IMPORTED_MODULE_2__["default"](this.sitemapBuilder, this.atomFeedBuilder).build(entry)];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return ArcadePageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ArcadePageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/errorPageBuilder.ts":
/*!*********************************************************!*\
  !*** ./src/server/ssg/builder/page/errorPageBuilder.ts ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var ErrorPageBuilder = /** @class */ (function () {
    function ErrorPageBuilder() {
    }
    ErrorPageBuilder.prototype.build = function (sourceDir, targetDir) {
        return __awaiter(this, void 0, void 0, function () {
            var relativeFilePaths, _i, relativeFilePaths_1, relativeFilePath, builder, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (sourceDir == undefined)
                            sourceDir = "".concat(process.env.VIEWS_ROOT_DIR, "/page/static/error");
                        if (targetDir == undefined)
                            targetDir = "".concat(process.env.STATIC_PAGE_ROOT_DIR, "/error");
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_1__["default"].getAllRelativePathsInDirRecursively(sourceDir)];
                    case 1:
                        relativeFilePaths = _c.sent();
                        relativeFilePaths = relativeFilePaths.filter(function (x) { return x.endsWith(".ejs"); });
                        _i = 0, relativeFilePaths_1 = relativeFilePaths;
                        _c.label = 2;
                    case 2:
                        if (!(_i < relativeFilePaths_1.length)) return [3 /*break*/, 6];
                        relativeFilePath = relativeFilePaths_1[_i];
                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__["default"]();
                        _b = (_a = builder).addLine;
                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__["default"].createStaticHTMLFromEJS("/page/static/error/" + relativeFilePath, {})];
                    case 3:
                        _b.apply(_a, [_c.sent()]);
                        return [4 /*yield*/, builder.build(relativeFilePath.replace(".ejs", ".html"), targetDir)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return ErrorPageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorPageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/libraryPageBuilder.ts":
/*!***********************************************************!*\
  !*** ./src/server/ssg/builder/page/libraryPageBuilder.ts ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var _libraryPostListPageBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./libraryPostListPageBuilder */ "./src/server/ssg/builder/page/libraryPostListPageBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _data_libraryData__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../data/libraryData */ "./src/server/ssg/data/libraryData.ts");
/* harmony import */ var _data_arcadeData__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../data/arcadeData */ "./src/server/ssg/data/arcadeData.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};






dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var LibraryPageBuilder = /** @class */ (function () {
    function LibraryPageBuilder(sitemapBuilder, atomFeedBuilder) {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    LibraryPageBuilder.prototype.build = function () {
        return __awaiter(this, void 0, void 0, function () {
            var builder, _a, _b, _i, _c, _d, category, entries;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__["default"]();
                        _b = (_a = builder).addLine;
                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__["default"].createStaticHTMLFromEJS("page/static/library.ejs", {
                                entriesByCategory: _data_libraryData__WEBPACK_IMPORTED_MODULE_4__.LibraryData.entriesByCategory,
                                gameEntries: _data_arcadeData__WEBPACK_IMPORTED_MODULE_5__.ArcadeData.gameEntries,
                            })];
                    case 1:
                        _b.apply(_a, [_e.sent()]);
                        return [4 /*yield*/, builder.build("library.html")];
                    case 2:
                        _e.sent();
                        this.sitemapBuilder.addEntry("library.html", "2025-02-28");
                        _i = 0, _c = Object.entries(_data_libraryData__WEBPACK_IMPORTED_MODULE_4__.LibraryData.entriesByCategory);
                        _e.label = 3;
                    case 3:
                        if (!(_i < _c.length)) return [3 /*break*/, 6];
                        _d = _c[_i], category = _d[0], entries = _d[1];
                        return [4 /*yield*/, new _libraryPostListPageBuilder__WEBPACK_IMPORTED_MODULE_2__["default"](this.sitemapBuilder, this.atomFeedBuilder).build(category, entries)];
                    case 4:
                        _e.sent();
                        _e.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return LibraryPageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LibraryPageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/libraryPostListPageBuilder.ts":
/*!*******************************************************************!*\
  !*** ./src/server/ssg/builder/page/libraryPostListPageBuilder.ts ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var _libraryPostPageBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./libraryPostPageBuilder */ "./src/server/ssg/builder/page/libraryPostPageBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var LibraryPostListPageBuilder = /** @class */ (function () {
    function LibraryPostListPageBuilder(sitemapBuilder, atomFeedBuilder) {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    LibraryPostListPageBuilder.prototype.build = function (category, entries) {
        return __awaiter(this, void 0, void 0, function () {
            var i, entry, postInfoList, listRelativeURL, builder, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(i < entries.length)) return [3 /*break*/, 6];
                        entry = entries[i];
                        return [4 /*yield*/, new _libraryPostPageBuilder__WEBPACK_IMPORTED_MODULE_2__["default"](this.sitemapBuilder, this.atomFeedBuilder).build(entry)];
                    case 2:
                        postInfoList = _c.sent();
                        listRelativeURL = "".concat(entry.dirName, "/list.html");
                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_1__["default"]();
                        _b = (_a = builder).addLine;
                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_0__["default"].createStaticHTMLFromEJS("page/static/libraryPostList.ejs", {
                                entry: entry,
                                listRelativeURL: listRelativeURL,
                                postInfoList: postInfoList
                            })];
                    case 3:
                        _b.apply(_a, [_c.sent()]);
                        return [4 /*yield*/, builder.build("".concat(entry.dirName, "/list.html"))];
                    case 4:
                        _c.sent();
                        this.sitemapBuilder.addEntry("".concat(entry.dirName, "/list.html"), postInfoList
                            .sort(function (info1, info2) { return Date.parse(info2.lastmod) - Date.parse(info1.lastmod); })
                            .pop().lastmod);
                        _c.label = 5;
                    case 5:
                        ++i;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    ;
    return LibraryPostListPageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LibraryPostListPageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/page/libraryPostPageBuilder.ts":
/*!***************************************************************!*\
  !*** ./src/server/ssg/builder/page/libraryPostPageBuilder.ts ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var LibraryPostPageBuilder = /** @class */ (function () {
    function LibraryPostPageBuilder(sitemapBuilder, atomFeedBuilder) {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    LibraryPostPageBuilder.prototype.build = function (entry) {
        return __awaiter(this, void 0, void 0, function () {
            var isFirstArticle, title, pageNumber, imageNumber, customOGImagePath, snippetOn, excerptOn, paragraphLinesPending, postInfoList, contentLines, desc, keywords, lastmod, prev_title, prev_desc, prev_keywords, prev_lastmod, endParagraph, buildPostPage, rawText, lines, i, line, date, imgName, imgPath;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        isFirstArticle = true;
                        title = "???";
                        pageNumber = 1;
                        imageNumber = 1;
                        customOGImagePath = undefined;
                        snippetOn = false;
                        excerptOn = false;
                        paragraphLinesPending = [];
                        postInfoList = [];
                        contentLines = [];
                        desc = "A writing by ThingsPool.";
                        keywords = "thingspool, software, engineering, philosophy";
                        lastmod = process.env.GLOBAL_LAST_MOD;
                        prev_title = title;
                        prev_desc = desc;
                        prev_keywords = keywords;
                        prev_lastmod = lastmod;
                        endParagraph = function () {
                            if (paragraphLinesPending.length > 0) {
                                if (snippetOn)
                                    contentLines.push("<div class=\"snippet\"><pre><code>".concat(paragraphLinesPending.join("\n"), "</code></pre></div>"));
                                else if (excerptOn)
                                    contentLines.push("<pre><div class=\"excerpt\">".concat(paragraphLinesPending.join("\n"), "</div></pre>"));
                                else
                                    contentLines.push("<p>".concat(paragraphLinesPending.join("<br>"), "</p>"));
                                paragraphLinesPending.length = 0;
                            }
                        };
                        buildPostPage = function (title, lastmod, desc, keywords, isLastPage) { return __awaiter(_this, void 0, void 0, function () {
                            var postRelativeURL, builder, _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        postRelativeURL = "".concat(entry.dirName, "/page-").concat(pageNumber, ".html");
                                        builder = new _textFileBuilder__WEBPACK_IMPORTED_MODULE_2__["default"]();
                                        _b = (_a = builder).addLine;
                                        return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/libraryPost.ejs", {
                                                title: title,
                                                desc: desc,
                                                keywords: keywords,
                                                customOGImagePath: customOGImagePath,
                                                entry: entry,
                                                pageNumber: pageNumber,
                                                isLastPage: isLastPage,
                                                content: contentLines.join("\n"),
                                            })];
                                    case 1:
                                        _b.apply(_a, [_c.sent()]);
                                        return [4 /*yield*/, builder.build(postRelativeURL)];
                                    case 2:
                                        _c.sent();
                                        contentLines.length = 0;
                                        this.sitemapBuilder.addEntry(postRelativeURL, lastmod);
                                        this.atomFeedBuilder.addEntry("".concat(process.env.URL_STATIC, "/").concat(postRelativeURL), title, lastmod, desc);
                                        postInfoList.push({ pageNumber: pageNumber, title: title, lastmod: lastmod, desc: desc, keywords: keywords, customOGImagePath: customOGImagePath });
                                        pageNumber++;
                                        imageNumber = 1;
                                        customOGImagePath = undefined;
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].read("".concat(entry.dirName, "/source.txt"))];
                    case 1:
                        rawText = _a.sent();
                        lines = rawText.split(/\r?\n/);
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < lines.length)) return [3 /*break*/, 8];
                        line = lines[i];
                        if (!snippetOn && !excerptOn)
                            line = line.trim();
                        if (!(line.length == 0)) return [3 /*break*/, 3];
                        if (snippetOn || excerptOn)
                            paragraphLinesPending.push("\n");
                        else
                            endParagraph();
                        return [3 /*break*/, 7];
                    case 3:
                        if (!line.startsWith("[")) return [3 /*break*/, 6];
                        endParagraph();
                        if (!isFirstArticle)
                            prev_title = title;
                        title = line.match(/\[(.*?)\]/)[1].trim();
                        date = line.match(/\](.*?)$/)[1].trim();
                        if (!!isFirstArticle) return [3 /*break*/, 5];
                        return [4 /*yield*/, buildPostPage(prev_title, prev_lastmod, prev_desc, prev_keywords, false)];
                    case 4:
                        _a.sent();
                        prev_desc = desc;
                        prev_keywords = keywords;
                        prev_lastmod = lastmod;
                        _a.label = 5;
                    case 5:
                        isFirstArticle = false;
                        contentLines.push("<h1>".concat(title, "</h1>"));
                        contentLines.push("<p class=\"dim\">Author: Youngjin Kang&nbsp;&nbsp;&nbsp;Date: ".concat(date, "</p>"));
                        return [3 /*break*/, 7];
                    case 6:
                        if (line.startsWith("<") && !snippetOn && !excerptOn) // image reference
                         {
                            endParagraph();
                            imgName = line.match(/<(.*?)>/)[1];
                            if (imgName.length > 0) {
                                imgPath = "".concat(process.env.URL_STATIC, "/").concat(entry.dirName, "/").concat(imgName, ".jpg");
                                if (customOGImagePath == undefined || line.endsWith("*"))
                                    customOGImagePath = imgPath;
                                contentLines.push("<img class=\"l_image\" src=\"".concat(imgPath, "\" alt=\"").concat(title.replaceAll("\"", "&quot;"), " (Figure ").concat(imageNumber++, ")\">"));
                            }
                        }
                        else if (line.startsWith("@@")) // Custom HTML tag
                         {
                            contentLines.push(line.substring(2));
                        }
                        else if (line.startsWith("#$")) // snippet
                         {
                            endParagraph();
                            snippetOn = !snippetOn;
                        }
                        else if (line.startsWith("#\"")) // excerpt
                         {
                            endParagraph();
                            excerptOn = !excerptOn;
                        }
                        else if (line.startsWith(":d:")) {
                            if (!isFirstArticle)
                                prev_desc = desc;
                            desc = line.substring(3);
                        }
                        else if (line.startsWith(":k:")) {
                            if (!isFirstArticle)
                                prev_keywords = keywords;
                            keywords = line.substring(3).toLowerCase().replaceAll("-", " ");
                        }
                        else if (line.startsWith(":l:")) {
                            if (!isFirstArticle)
                                prev_lastmod = lastmod;
                            lastmod = line.substring(3);
                        }
                        else // plain text
                         {
                            line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
                            paragraphLinesPending.push(line);
                        }
                        _a.label = 7;
                    case 7:
                        ++i;
                        return [3 /*break*/, 2];
                    case 8:
                        endParagraph();
                        return [4 /*yield*/, buildPostPage(title, lastmod, desc, keywords, true)];
                    case 9:
                        _a.sent();
                        return [2 /*return*/, postInfoList];
                }
            });
        });
    };
    ;
    return LibraryPostPageBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LibraryPostPageBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/sitemapBuilder.ts":
/*!**************************************************!*\
  !*** ./src/server/ssg/builder/sitemapBuilder.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var SitemapBuilder = /** @class */ (function () {
    function SitemapBuilder() {
        this.lines = ["</urlset>"];
    }
    SitemapBuilder.prototype.addEntry = function (relativeURL, lastmod) {
        this.lines.push("</url>");
        this.lines.push("  <lastmod>".concat(lastmod, "</lastmod>"));
        this.lines.push("  <loc>".concat(process.env.URL_STATIC, "/").concat(relativeURL, "</loc>"));
        this.lines.push("<url>");
    };
    SitemapBuilder.prototype.build = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.lines.push("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
                        this.lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
                        this.lines.reverse();
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].write("sitemap.xml", this.lines.join("\n"))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return SitemapBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SitemapBuilder);


/***/ }),

/***/ "./src/server/ssg/builder/textFileBuilder.ts":
/*!***************************************************!*\
  !*** ./src/server/ssg/builder/textFileBuilder.ts ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


dotenv__WEBPACK_IMPORTED_MODULE_1___default().config();
var TextFileBuilder = /** @class */ (function () {
    function TextFileBuilder() {
        this.lines = [];
    }
    TextFileBuilder.prototype.addLine = function (line) {
        this.lines.push(line);
    };
    TextFileBuilder.prototype.getText = function () {
        return this.lines.join("\n");
    };
    TextFileBuilder.prototype.build = function (relativeFilePath, rootDir) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (rootDir == undefined)
                            rootDir = process.env.STATIC_PAGE_ROOT_DIR;
                        return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].write(relativeFilePath, this.lines.join("\n"), rootDir)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return TextFileBuilder;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TextFileBuilder);


/***/ }),

/***/ "./src/server/ssg/data/arcadeData.ts":
/*!*******************************************!*\
  !*** ./src/server/ssg/data/arcadeData.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ArcadeData: () => (/* binding */ ArcadeData)
/* harmony export */ });
var ArcadeData = {
    gameEntries: [
        {
            dirName: "ArtRaider",
            title: "ArtRaider",
            playLinkImagePathOverride: "badge_onestore.png",
            playLinkURL: "https://onesto.re/0001000383",
            videoTag: "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/RuLgOJrNtKA?si=Ts_Yu_jdpB1qmNiT\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>",
            lastmod: "2025-04-15",
        },
        {
            dirName: "Water-vs-Fire",
            title: "Water vs Fire",
            playLinkURL: "https://www.gamearter.com/game/water-vs-fire",
            videoTag: "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/6DeA_m8Iq4M?si=hC1uzkEtBWpYcM8z\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>",
            lastmod: "2023-09-10",
        },
        {
            dirName: "HuntLand",
            title: "HuntLand",
            playLinkURL: "https://www.gamearter.com/game/huntland",
            videoTag: "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/3dRg6vvoPqc?si=FlnKVyzQq0_55sL2\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>",
            lastmod: "2023-09-10",
        },
        {
            dirName: "PoliceChase",
            title: "Police Chase",
            playLinkURL: "https://www.gamearter.com/game/policechase",
            videoTag: "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/kABg0j2mZqQ?si=3-JUZQnh3omVXSJd\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>",
            lastmod: "2023-09-10",
        },
        {
            dirName: "SpaceTown",
            title: "SpaceTown",
            playLinkURL: "https://www.gamearter.com/game/spacetown",
            videoTag: "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/NoiQzEKJM-A?si=o8vTNqW1kxCJ4MnW\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>",
            lastmod: "2023-09-20",
        },
    ]
};


/***/ }),

/***/ "./src/server/ssg/data/libraryData.ts":
/*!********************************************!*\
  !*** ./src/server/ssg/data/libraryData.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LibraryData: () => (/* binding */ LibraryData)
/* harmony export */ });
var LibraryData = {
    entriesByCategory: {
        "Nonfiction": [
            { dirName: "metaphysics", title: "형이상학 (2013 - 2014)" },
            { dirName: "game-analysis", title: "게임분석 (2019)" },
            { dirName: "essays", title: "Miscellaneous Writings (2022 - 2024)" },
            { dirName: "blockchains", title: "On Legitimacy of Blockchains (2022)" },
            { dirName: "software-development", title: "Software Development (2022 - 2024)" },
            { dirName: "game-design", title: "Universal Laws of Game Design (2023)" },
            { dirName: "reality", title: "The Origin of Reality (2023)" },
            { dirName: "bridge-to-math", title: "A Layman's Bridge to Mathematics (2024)" },
            { dirName: "read-rec", title: "Recommended Readings (2024)" },
            { dirName: "morsels", title: "Morsels of Thought (2024)" },
            { dirName: "concepts-of-plan", title: "Concepts of a Plan (2025)" },
        ],
        "Fiction": [
            { dirName: "novels", title: "단편소설 (2012 - 2013)" },
            { dirName: "alien-job-interview", title: "Alien Job Interview (2022)" },
            { dirName: "infinite-treasures", title: "The Island of Infinite Treasures (2022)" },
            { dirName: "infsoc", title: "Influential Social Posts (2023)" },
            { dirName: "gamedev-journey", title: "A Game Developer's Journey (2023)" },
            { dirName: "sandwich", title: "Sandwich Engineering (2025)" },
        ],
        "Arts": [
            { dirName: "illustrations", title: "Illustrations (2009 - 2014)" },
            { dirName: "cartoons", title: "Cartoons (2011 - 2015)" },
        ],
    }
};


/***/ }),

/***/ "./src/server/ssg/ssg.ts":
/*!*******************************!*\
  !*** ./src/server/ssg/ssg.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SSG)
/* harmony export */ });
/* harmony import */ var _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/ejsUtil */ "./src/server/util/ejsUtil.ts");
/* harmony import */ var _builder_sitemapBuilder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./builder/sitemapBuilder */ "./src/server/ssg/builder/sitemapBuilder.ts");
/* harmony import */ var _builder_atomFeedBuilder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./builder/atomFeedBuilder */ "./src/server/ssg/builder/atomFeedBuilder.ts");
/* harmony import */ var _builder_page_arcadePageBuilder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./builder/page/arcadePageBuilder */ "./src/server/ssg/builder/page/arcadePageBuilder.ts");
/* harmony import */ var _builder_page_libraryPageBuilder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./builder/page/libraryPageBuilder */ "./src/server/ssg/builder/page/libraryPageBuilder.ts");
/* harmony import */ var _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./builder/textFileBuilder */ "./src/server/ssg/builder/textFileBuilder.ts");
/* harmony import */ var _builder_embeddedScriptBuilder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./builder/embeddedScriptBuilder */ "./src/server/ssg/builder/embeddedScriptBuilder.ts");
/* harmony import */ var _style_styleDictionary__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./style/styleDictionary */ "./src/server/ssg/style/styleDictionary.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var _builder_page_errorPageBuilder__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./builder/page/errorPageBuilder */ "./src/server/ssg/builder/page/errorPageBuilder.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};











dotenv__WEBPACK_IMPORTED_MODULE_9___default().config();
function SSG() {
    return __awaiter(this, void 0, void 0, function () {
        var sitemapB, atomFeedB, tb, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    console.log("SSG START");
                    sitemapB = new _builder_sitemapBuilder__WEBPACK_IMPORTED_MODULE_2__["default"]();
                    atomFeedB = new _builder_atomFeedBuilder__WEBPACK_IMPORTED_MODULE_3__["default"]();
                    tb = new _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__["default"]();
                    _b = (_a = tb).addLine;
                    return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/index.ejs", {})];
                case 1:
                    _b.apply(_a, [_l.sent()]);
                    return [4 /*yield*/, tb.build("index.html")];
                case 2:
                    _l.sent();
                    tb = new _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__["default"]();
                    _d = (_c = tb).addLine;
                    return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/portfolio.ejs", {})];
                case 3:
                    _d.apply(_c, [_l.sent()]);
                    return [4 /*yield*/, tb.build("portfolio.html")];
                case 4:
                    _l.sent();
                    tb = new _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__["default"]();
                    _f = (_e = tb).addLine;
                    return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/portfolio_minimal.ejs", {})];
                case 5:
                    _f.apply(_e, [_l.sent()]);
                    return [4 /*yield*/, tb.build("portfolio_minimal.html")];
                case 6:
                    _l.sent();
                    tb = new _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__["default"]();
                    _h = (_g = tb).addLine;
                    return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/privacyPolicy.ejs", {})];
                case 7:
                    _h.apply(_g, [_l.sent()]);
                    return [4 /*yield*/, tb.build("privacy-policy.html")];
                case 8:
                    _l.sent();
                    tb = new _builder_textFileBuilder__WEBPACK_IMPORTED_MODULE_6__["default"]();
                    _k = (_j = tb).addLine;
                    return [4 /*yield*/, _util_ejsUtil__WEBPACK_IMPORTED_MODULE_1__["default"].createStaticHTMLFromEJS("page/static/termsOfService.ejs", {})];
                case 9:
                    _k.apply(_j, [_l.sent()]);
                    return [4 /*yield*/, tb.build("terms-of-service.html")];
                case 10:
                    _l.sent();
                    return [4 /*yield*/, new _builder_page_arcadePageBuilder__WEBPACK_IMPORTED_MODULE_4__["default"](sitemapB, atomFeedB).build()];
                case 11:
                    _l.sent();
                    return [4 /*yield*/, new _builder_page_libraryPageBuilder__WEBPACK_IMPORTED_MODULE_5__["default"](sitemapB, atomFeedB).build()];
                case 12:
                    _l.sent();
                    return [4 /*yield*/, new _builder_page_errorPageBuilder__WEBPACK_IMPORTED_MODULE_10__["default"]().build()];
                case 13:
                    _l.sent();
                    return [4 /*yield*/, sitemapB.build()];
                case 14:
                    _l.sent();
                    return [4 /*yield*/, atomFeedB.build()];
                case 15:
                    _l.sent();
                    // Generate CSS
                    return [4 /*yield*/, _util_fileUtil__WEBPACK_IMPORTED_MODULE_0__["default"].write("style.css", _style_styleDictionary__WEBPACK_IMPORTED_MODULE_8__["default"])];
                case 16:
                    // Generate CSS
                    _l.sent();
                    // Generate embedded scripts
                    return [4 /*yield*/, new _builder_embeddedScriptBuilder__WEBPACK_IMPORTED_MODULE_7__["default"]().build()];
                case 17:
                    // Generate embedded scripts
                    _l.sent();
                    console.log("SSG END");
                    return [2 /*return*/];
            }
        });
    });
}


/***/ }),

/***/ "./src/server/ssg/style/styleDictionary.ts":
/*!*************************************************!*\
  !*** ./src/server/ssg/style/styleDictionary.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
//------------------------------------------------------------------------
// Global Parameters
//------------------------------------------------------------------------
var extraDarkColor = "#101010";
var darkColor = "#303030";
var dimColor = "#707070";
var mediumColor = "#a0a0a0";
var lightColor = "#c0c0c0";
var lightYellowColor = "#d0c090";
var lightGreenColor = "#70c060";
var mediumYellowColor = "#b0a070";
var defaultTextAlign = "left";
var fullscreenBarTextAlign = "center";
var fullscreenLeftBarWidthPercent = 14;
var fullscreenTopBarHeightPercent = 12;
var fullscreenLeftBarLogoAreaHeightPercent = 14;
var fullscreenTopBarLogoAreaHeightPercent = 65;
var fullscreenPanelWidthPaddingPercent = 2.5;
var scrollbar_thickness = "17px";
var scrollbar_border_radius = "8px";
var scrollbar_border_thickness = "4px";
var space = {
    unit: {
        landscape: {
            vertical: 0.6,
            horizontal: 1,
        },
        portrait: {
            vertical: 1,
            horizontal: 2.5,
        },
    },
};
var regular_font_weight = 400;
var bold_font_weight = 800;
var fontScaleFactor_vmax = 0.7;
var fontScaleFactor_px = 1.0;
var font_vmax_min = 2.6;
var font_px_min = 16;
var fontScaleInc = 1.2;
var fontScaleInc2 = fontScaleInc * fontScaleInc;
var fontScaleInc3 = fontScaleInc * fontScaleInc * fontScaleInc;
var fontScaleInc4 = fontScaleInc * fontScaleInc * fontScaleInc * fontScaleInc;
//------------------------------------------------------------------------
// Functions
//------------------------------------------------------------------------
// Areas
var absoluteArea = function (leftPercent, rightPercent, topPercent, bottomPercent, widthPercent, heightPercent) {
    return "position: absolute;\n\tdisplay: block;\n\tleft: ".concat(leftPercent, "%;\n\tright: ").concat(rightPercent, "%;\n\ttop: ").concat(topPercent, "%;\n\tbottom: ").concat(bottomPercent, "%;\n\twidth: ").concat(widthPercent, "%;\n\theight: ").concat(heightPercent, "%;");
};
var relativeArea = function (nextline, maxWidth) {
    return "position: relative;\n\tdisplay: ".concat(nextline ? "block" : "inline-block", ";\n\tmax-width: ").concat(maxWidth, ";");
};
var relativeAndFlexibleArea = function (nextline) {
    return "position: relative;\n\tdisplay: ".concat(nextline ? "block" : "inline-block", ";\n\tmax-width: none;\n\twidth: fit-content;\n\tblock-size: fit-content;");
};
var relativeFixedSizeArea = function (nextline, width, height) {
    return "position: relative;\n\tdisplay: ".concat(nextline ? "block" : "inline-block", ";\n\twidth: ").concat(width, ";\n\theight: ").concat(height, ";");
};
// Spacing
var spacing = function (landscape, verticalScale, horizontalScale, suppressMargin, suppressPadding) {
    if (suppressMargin === void 0) { suppressMargin = false; }
    if (suppressPadding === void 0) { suppressPadding = false; }
    var unit = space.unit[landscape ? "landscape" : "portrait"];
    var verticalSize = (unit.vertical * verticalScale).toFixed(2);
    var horizontalSize = (unit.horizontal * horizontalScale).toFixed(2);
    var verticalPadding = suppressPadding ? "0" : "".concat(verticalSize, "%");
    var horizontalPadding = suppressPadding ? "0" : "".concat(horizontalSize, "%");
    var verticalMargin = suppressMargin ? "0" : "".concat(verticalSize, "%");
    var horizontalMargin = suppressMargin ? "0" : "".concat(horizontalSize, "%");
    return "padding: ".concat(verticalPadding, " ").concat(horizontalPadding, " ").concat(verticalPadding, " ").concat(horizontalPadding, ";\n\tmargin: ").concat(verticalMargin, " ").concat(horizontalMargin, " ").concat(verticalMargin, " 0;");
};
// Font
var font = function (fontSize, isItalic, fontWeight) {
    return "font-size: ".concat(fontSize, ";\n\tfont-family: \"Lucida Console\", \"Lucida Sans Typewriter\", \"Monaco\", Consolas, monospace;\n\tfont-style: ").concat(isItalic ? "italic" : "normal", ";\n\tfont-weight: ").concat(fontWeight, ";");
};
// Frames
var simpleFrame = function (backgroundColor, foregroundColor, opacity) {
    if (opacity === void 0) { opacity = 1; }
    return "background-color: ".concat(backgroundColor, ";\n\tcolor: ").concat(foregroundColor, ";").concat((opacity < 1) ? "\n\topacity: ".concat(opacity, ";") : "");
};
var roundedFrame = function (backgroundColor, foregroundColor, opacity) {
    if (opacity === void 0) { opacity = 1; }
    return simpleFrame(backgroundColor, foregroundColor, opacity) + "\n" +
        "\tborder-radius: 2vmin;";
};
var elevatedFrame = function (backgroundColor, foregroundColor, borderColor, borderThickness, opacity) {
    if (borderThickness === void 0) { borderThickness = "1.25"; }
    if (opacity === void 0) { opacity = 1; }
    return roundedFrame(backgroundColor, foregroundColor, opacity) + "\n" +
        "\tborder-bottom: ".concat(borderThickness, "vmin ").concat(borderColor, " solid;") + "\n" +
        "\tborder-right: ".concat(borderThickness, "vmin ").concat(borderColor, " solid;");
};
var outlinedFrame = function (backgroundColor, foregroundColor, borderColor, borderThickness, opacity) {
    if (borderThickness === void 0) { borderThickness = "1.25"; }
    if (opacity === void 0) { opacity = 1; }
    return roundedFrame(backgroundColor, foregroundColor, opacity) + "\n" +
        "\tborder: ".concat(borderThickness, "vmin ").concat(borderColor, " solid;");
};
var underlinedFrame = function (backgroundColor, foregroundColor, underlineColor, underlineThickness, opacity) {
    if (underlineThickness === void 0) { underlineThickness = "1.25"; }
    if (opacity === void 0) { opacity = 1; }
    return simpleFrame(backgroundColor, foregroundColor, opacity) + "\n" +
        "\tborder-bottom: ".concat(underlineThickness, "vmin ").concat(underlineColor, " solid;");
};
//------------------------------------------------------------------------
// Elementary Styles
//------------------------------------------------------------------------
var fullscreen_whole_area = absoluteArea(0, 0, 0, 0, 100, 100);
var fullscreen_left_bar_area = absoluteArea(0, 100 - fullscreenLeftBarWidthPercent, 0, 0, fullscreenLeftBarWidthPercent, 100);
var fullscreen_top_bar_area = absoluteArea(0, 0, 0, 100 - fullscreenTopBarHeightPercent, 100, fullscreenTopBarHeightPercent);
var fullscreen_right_panel_area = absoluteArea(fullscreenLeftBarWidthPercent, 2 * fullscreenPanelWidthPaddingPercent, 0, 0, 100 - (fullscreenLeftBarWidthPercent + 2 * fullscreenPanelWidthPaddingPercent), 100);
var fullscreen_bottom_panel_area = absoluteArea(0, fullscreenPanelWidthPaddingPercent, fullscreenTopBarHeightPercent, 0, 100 - 2 * fullscreenPanelWidthPaddingPercent, 100 - fullscreenTopBarHeightPercent);
var fullscreen_left_bar_logo_area = absoluteArea(0, 0, 0, 100 - fullscreenLeftBarLogoAreaHeightPercent, 100, fullscreenLeftBarLogoAreaHeightPercent);
var fullscreen_left_bar_menu_area = absoluteArea(0, 0, fullscreenLeftBarLogoAreaHeightPercent, 0, 100, 80);
var fullscreen_top_bar_logo_area = absoluteArea(0, 0, 0, 100 - fullscreenTopBarLogoAreaHeightPercent, 100, fullscreenTopBarLogoAreaHeightPercent);
var fullscreen_top_bar_menu_area = absoluteArea(0, 0, fullscreenTopBarLogoAreaHeightPercent, 0, 100, 100 - fullscreenTopBarLogoAreaHeightPercent);
var list_scroll_panel_area = function (_) { return relativeFixedSizeArea(true, "".concat((100).toFixed(2), "%"), "".concat((70).toFixed(2), "%")); };
var getGraceWidthPercent = function (landscape) {
    return 2 * space.unit[landscape ? "landscape" : "portrait"].horizontal;
};
var full_row_area = function (landscape) { return relativeArea(true, "".concat((100).toFixed(2), "%")); };
var near_full_row_area = function (landscape) { return relativeArea(true, "".concat((98).toFixed(2), "%")); };
var twoThirds_row_area = function (landscape) { return relativeArea(true, "".concat((66 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var half_row_area = function (landscape) { return relativeArea(true, "".concat((50 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var third_row_area = function (landscape) { return relativeArea(true, "".concat((33 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var quarter_row_area = function (landscape) { return relativeArea(true, "".concat((25 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var fifth_row_area = function (landscape) { return relativeArea(true, "".concat((20 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var tiny_row_area = function (_) { return relativeArea(true, "1%"); };
var flexible_row_area = function (_) { return relativeAndFlexibleArea(true); };
var full_col_area = function (landscape) { return relativeArea(false, "".concat((100).toFixed(2), "%")); };
var near_full_col_area = function (landscape) { return relativeArea(false, "".concat((98).toFixed(2), "%")); };
var twoThirds_col_area = function (landscape) { return relativeArea(false, "".concat((66 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var half_col_area = function (landscape) { return relativeArea(false, "".concat((50 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var third_col_area = function (landscape) { return relativeArea(false, "".concat((33 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var quarter_col_area = function (landscape) { return relativeArea(false, "".concat((25 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var fifth_col_area = function (landscape) { return relativeArea(false, "".concat((20 - getGraceWidthPercent(landscape)).toFixed(2), "%")); };
var tiny_col_area = function (_) { return relativeArea(false, "1%"); };
var flexible_col_area = function (_) { return relativeAndFlexibleArea(false); };
var zero_spacing = function (_) { return "padding: 0 0 0 0; margin: 0 0 0 0;"; };
var xs_spacing = function (landscape) { return spacing(landscape, 0.5, 1); };
var s_spacing = function (landscape) { return spacing(landscape, 1, 1); };
var m_spacing = function (landscape) { return spacing(landscape, 2, 2); };
var l_spacing = function (landscape) { return spacing(landscape, 3, 3); };
var xl_spacing = function (landscape) { return spacing(landscape, 4, 4); };
var xxl_spacing = function (landscape) { return spacing(landscape, 6, 6); };
var xs_spacing_paddingOnly = function (landscape) { return spacing(landscape, 0.5, 1, true, false); };
var xs_spacing_marginOnly = function (landscape) { return spacing(landscape, 0.5, 1, false, true); };
var s_spacing_paddingOnly = function (landscape) { return spacing(landscape, 1, 1, true, false); };
var s_spacing_marginOnly = function (landscape) { return spacing(landscape, 1, 1, false, true); };
var m_spacing_paddingOnly = function (landscape) { return spacing(landscape, 2, 1, true, false); };
var m_spacing_marginOnly = function (landscape) { return spacing(landscape, 2, 1, false, true); };
var l_spacing_paddingOnly = function (landscape) { return spacing(landscape, 3, 1, true, false); };
var l_spacing_marginOnly = function (landscape) { return spacing(landscape, 3, 1, false, true); };
var xl_spacing_paddingOnly = function (landscape) { return spacing(landscape, 4, 1, true, false); };
var xl_spacing_marginOnly = function (landscape) { return spacing(landscape, 4, 1, false, true); };
var size_s_font = "min(".concat((font_vmax_min * fontScaleFactor_vmax).toFixed(2), "vmax, ").concat((font_px_min * fontScaleFactor_px).toFixed(2), "px)");
var size_m_font = "min(".concat((font_vmax_min * fontScaleInc * fontScaleFactor_vmax).toFixed(2), "vmax, ").concat((font_px_min * fontScaleInc * fontScaleFactor_px).toFixed(2), "px)");
var size_l_font = "min(".concat((font_vmax_min * fontScaleInc2 * fontScaleFactor_vmax).toFixed(2), "vmax, ").concat((font_px_min * fontScaleInc2 * fontScaleFactor_px).toFixed(2), "px)");
var size_xl_font = "min(".concat((font_vmax_min * fontScaleInc3 * fontScaleFactor_vmax).toFixed(2), "vmax, ").concat((font_px_min * fontScaleInc3 * fontScaleFactor_px).toFixed(2), "px)");
var size_xxl_font = "min(".concat((font_vmax_min * fontScaleInc4 * fontScaleFactor_vmax).toFixed(2), "vmax, ").concat((font_px_min * fontScaleInc4 * fontScaleFactor_px).toFixed(2), "px)");
var s_font = font(size_s_font, false, regular_font_weight);
var s_italic_font = font(size_s_font, true, regular_font_weight);
var s_bold_font = font(size_s_font, false, bold_font_weight);
var m_font = font(size_m_font, true, regular_font_weight);
var m_bold_font = font(size_m_font, true, bold_font_weight);
var l_font = font(size_l_font, true, regular_font_weight);
var l_bold_font = font(size_l_font, true, bold_font_weight);
var xl_font = font(size_xl_font, true, regular_font_weight);
var xl_bold_font = font(size_xl_font, true, bold_font_weight);
var xxl_font = font(size_xxl_font, true, regular_font_weight);
var xxl_bold_font = font(size_xxl_font, true, bold_font_weight);
var transparent_frame = "opacity: 0;";
var loading_screen_background_frame = simpleFrame("#000000", lightColor, 0.7);
var loading_screen_content_frame = elevatedFrame(lightYellowColor, darkColor, mediumYellowColor, "1.25");
var popup_screen_background_frame = simpleFrame("#000000", lightColor, 0.7);
var popup_screen_content_frame = elevatedFrame(darkColor, mediumColor, lightColor, "1.25");
var light_color_frame = simpleFrame(darkColor, lightColor);
var underlined_light_color_frame = underlinedFrame(darkColor, lightColor, lightColor);
var medium_color_frame = simpleFrame(darkColor, mediumColor);
var inverted_medium_color_frame = simpleFrame(mediumColor, darkColor);
var dim_color_frame = simpleFrame(darkColor, dimColor);
var lightYellow_color_frame = simpleFrame(darkColor, lightYellowColor);
var mediumYellow_color_frame = simpleFrame(darkColor, mediumYellowColor);
var linkImage_frame = elevatedFrame(darkColor, mediumColor, mediumColor);
var img_frame = roundedFrame(darkColor, lightColor);
var snippet_frame = roundedFrame(extraDarkColor, lightGreenColor);
var excerpt_frame = roundedFrame(extraDarkColor, lightGreenColor);
var button_frame = elevatedFrame(extraDarkColor, mediumColor, dimColor, "0.5");
var big_button_frame = elevatedFrame(extraDarkColor, mediumColor, dimColor, "0.75");
var text_input_frame = elevatedFrame(dimColor, lightColor, mediumColor, "0.25");
var list_scroll_panel_frame = outlinedFrame(darkColor, lightColor, dimColor, "0.1");
var list_item_frame = outlinedFrame(mediumColor, lightColor, lightColor, "0.1");
//------------------------------------------------------------------------
// Orientation-Dependent Styles
//------------------------------------------------------------------------
var stylesForOrientation = function (landscape) {
    return "\n@supports(-moz-appearance:none) {\n\t* {\n\t\tscrollbar-width: ".concat(landscape ? "auto" : "none", ";\n\t\tscrollbar-color: ").concat(dimColor, " ").concat(extraDarkColor, ";\n\t}\n}\n::-webkit-scrollbar {\n\twidth: ").concat(landscape ? scrollbar_thickness : "0", ";\n\theight: ").concat(landscape ? scrollbar_thickness : "0", ";\n}\n::-webkit-scrollbar-track {\n\tbackground: ").concat(extraDarkColor, ";\n}\n::-webkit-scrollbar-thumb {\n\tbackground: ").concat(dimColor, ";\n\tborder-radius: ").concat(scrollbar_border_radius, ";\n\tborder: ").concat(scrollbar_border_thickness, " solid ").concat(extraDarkColor, ";\n}\n::-webkit-scrollbar-thumb:hover {\n\tbackground: ").concat(mediumColor, ";\n}\niframe {\n\t").concat(full_row_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(l_bold_font, "\n\t").concat(medium_color_frame, "\n}\np {\n\t").concat(full_row_area(landscape), "\n\t").concat(xl_spacing_marginOnly(landscape), "\n\t").concat(s_font, "\n\t").concat(light_color_frame, "\n}\nh3 {\n\t").concat(full_row_area(landscape), "\n\t").concat(xl_spacing_marginOnly(landscape), "\n\t").concat(m_bold_font, "\n\t").concat(mediumYellow_color_frame, "\n}\nh2 {\n\t").concat(full_row_area(landscape), "\n\t").concat(xl_spacing_marginOnly(landscape), "\n\t").concat(xl_bold_font, "\n\t").concat(dim_color_frame, "\n}\nh1 {\n\t").concat(full_row_area(landscape), "\n\t").concat(xl_spacing_marginOnly(landscape), "\n\t").concat(xxl_bold_font, "\n\t").concat(lightYellow_color_frame, "\n}\nhr {\n\t").concat(full_row_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(light_color_frame, "\n}\n.fullscreenBar {\n\t").concat(landscape ? fullscreen_left_bar_area : fullscreen_top_bar_area, "\n\t").concat(zero_spacing(landscape), "\n\t").concat(m_bold_font, "\n\t").concat(inverted_medium_color_frame, "\n\ttext-align: ").concat(fullscreenBarTextAlign, ";\n\tz-index: 1;\n\toverflow: hidden;\n}\n.fullscreenPanel {\n\t").concat(landscape ? fullscreen_right_panel_area : fullscreen_bottom_panel_area, "\n\tmargin: 0 0 0 0;\n\tpadding: 0 ").concat(fullscreenPanelWidthPaddingPercent, "% 0 ").concat(fullscreenPanelWidthPaddingPercent, "%;\n\t").concat(l_bold_font, "\n\t").concat(medium_color_frame, "\n\toverflow-y: scroll;\n\toverflow-x: auto;\n}\n.fullscreenBarLogo {\n\t").concat(landscape ? fullscreen_left_bar_logo_area : fullscreen_top_bar_logo_area, "\n}\n.fullscreenBarLogoImage {\n\tposition: relative;\n\tdisplay: block;\n\tmax-width: 80%;\n\tmax-height: 70%;\n\tmargin: auto;\n  \ttop: 50%;\n  \t-ms-transform: translateY(-50%);\n  \ttransform: translateY(-50%);\n}\n.fullscreenBarMenu {\n\t").concat(landscape ? fullscreen_left_bar_menu_area : fullscreen_top_bar_menu_area, "\n}\n.fullscreenBarMenuButton {\n\tposition: relative;\n\tdisplay: ").concat(landscape ? "block" : "inline-block", ";\n\t").concat(landscape ? "width: 100%;" : "top: 100%; -ms-transform: translateY(-100%); transform: translateY(-100%);", "\n\tmax-height: 100%;\n\t").concat(landscape ? xl_spacing_paddingOnly(landscape) : s_spacing_paddingOnly(landscape), "\n\tbox-sizing: border-box;\n\ttext-decoration: none;\n}\n.fullscreenBarMenuButton.idle {\n\t").concat(inverted_medium_color_frame, "\n}\n.fullscreenBarMenuButton.selected {\n\t").concat(medium_color_frame, "\n}\n.fullscreenBarMenuButton.idle:hover {\n\tcolor: ").concat(lightYellowColor, ";\n}\n.fullscreenBarMenuButton.selected:hover {\n\tcolor: ").concat(lightYellowColor, ";\n}\n.loadingScreen {\n\t").concat(fullscreen_whole_area, "\n\t").concat(zero_spacing(landscape), "\n\tz-index: 900;\n\n\t.background {\n\t\t").concat(fullscreen_whole_area, "\n\t\t").concat(zero_spacing(landscape), "\n\t\t").concat(loading_screen_background_frame, "\n\t}\n\t.content {\n\t\tposition: absolute;\n\t\tmin-width: 50%;\n\t\ttop: 50%;\n\t\tleft: 50%;\n\t\ttransform: translate(-50%, -50%);\n\t\t").concat(xxl_bold_font, "\n\t\t").concat(xl_spacing(landscape), "\n\t\t").concat(loading_screen_content_frame, "\n\t\ttext-align: center;\n\t\tz-index: 901;\n\t}\n}\n.popupScreen {\n\t").concat(fullscreen_whole_area, "\n\t").concat(zero_spacing(landscape), "\n\tz-index: 500;\n\n\t.background {\n\t\t").concat(fullscreen_whole_area, "\n\t\t").concat(zero_spacing(landscape), "\n\t\t").concat(popup_screen_background_frame, "\n\t}\n\t.content {\n\t\tposition: absolute;\n\t\twidth: 80%;\n\t\twidth: 80%;\n\t\ttop: 50%;\n\t\tleft: 50%;\n\t\ttransform: translate(-50%, -50%);\n\t\t").concat(s_font, "\n\t\t").concat(m_spacing(landscape), "\n\t\t").concat(popup_screen_content_frame, "\n\t\toverflow-y: scroll;\n\t\tz-index: 501;\n\t}\n}\n.s_image {\n\t").concat(landscape ? quarter_col_area(landscape) : half_col_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(l_bold_font, "\n\t").concat(img_frame, "\n}\n.m_image {\n\t").concat(landscape ? third_col_area(landscape) : full_col_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(l_bold_font, "\n\t").concat(img_frame, "\n}\n.m_linkImage {\n\t").concat(landscape ? third_col_area(landscape) : near_full_col_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(l_bold_font, "\n\t").concat(linkImage_frame, "\n}\n.m_linkImage:hover {\n\tborder-color: ").concat(lightYellowColor, ";\n}\n.l_image {\n\t").concat(landscape ? half_col_area(landscape) : full_col_area(landscape), "\n\t").concat(m_spacing_marginOnly(landscape), "\n\t").concat(l_bold_font, "\n\t").concat(img_frame, "\n}\n.portal {\n\tposition: relative;\n\tdisplay: block;\n\tmargin: ").concat(landscape ? "5%" : "12.5%", " 0;\n\tpadding: 0 0;\n\tmax-width: ").concat(landscape ? "30%" : "70%", ";\n}\n.postEntryButton {\n\t").concat(flexible_row_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(s_bold_font, "\n\t").concat(button_frame, "\n\ttext-decoration: none;\n}\n.postEntryButton:hover {\n\tborder-color: ").concat(lightYellowColor, ";\n}\n.bigButton {\n\t").concat(flexible_row_area(landscape), "\n\t").concat(xxl_spacing(landscape), "\n\t").concat(m_bold_font, "\n\t").concat(big_button_frame, "\n\ttext-decoration: none;\n\ttext-align: center;\n}\n.bigButton:hover {\n\tborder-color: ").concat(lightYellowColor, ";\n}\n.pagePath {\n\t").concat(s_spacing_marginOnly(landscape), "\n\t").concat(s_font, "\n}\n.listScrollPanel {\n\t").concat(list_scroll_panel_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(list_scroll_panel_frame, "\n\toverflow: auto;\n}\n.listItem {\n\t").concat(flexible_row_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(s_font, "\n\t").concat(list_item_frame, "\n\ttext-decoration: none;\n}\n.inlineTextInput {\n\t").concat(landscape ? flexible_col_area(landscape) : flexible_row_area(landscape), "\n\t").concat(landscape ? s_spacing(landscape) : s_spacing(landscape), "\n\t").concat(s_font, "\n\t").concat(text_input_frame, "\n}\n.inlineLabel {\n\t").concat(flexible_col_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(s_font, "\n\t").concat(medium_color_frame, "\n}\n.inlineButton {\n\t").concat(flexible_col_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(s_font, "\n\t").concat(button_frame, "\n\ttext-decoration: none;\n}\n.inlineButton:hover {\n\tborder-color: ").concat(lightYellowColor, ";\n\tcursor: pointer;\n}\n.inlineButton:disabled {\n\topacity: 0.25;\n\tcursor: not-allowed;\n}\n.inlineTabButton {\n\t").concat(flexible_col_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(s_font, "\n\ttext-decoration: none;\n}\n.inlineTabButton.idle {\n\t").concat(light_color_frame, "\n}\n.inlineTabButton.selected {\n\t").concat(underlined_light_color_frame, "\n}\n.inlineTabButton.idle:hover {\n\tcolor: ").concat(lightYellowColor, ";\n}\n.inlineTabButton.selected:hover {\n\tcolor: ").concat(lightYellowColor, ";\n}\n.snippet {\n\t").concat(flexible_row_area(landscape), "\n\t").concat(m_spacing(landscape), "\n\t").concat(s_bold_font, "\n\t").concat(snippet_frame, "\n\twhite-space: nowrap;\n}\n.excerpt {\n\t").concat(full_row_area(landscape), "\n\t").concat(m_spacing(landscape), "\n\t").concat(s_italic_font, "\n\t").concat(excerpt_frame, "\n\twhite-space: pre-wrap;\n\twhite-space: -moz-pre-wrap;\n\twhite-space: -pre-wrap;\n\twhite-space: -o-pre-wrap;\n\tword-wrap: break-word;\n}\n.zero_row {\n\t").concat(tiny_row_area(), "\n\t").concat(zero_spacing(), "\n\t").concat(transparent_frame, "\n}\n.xs_row {\n\t").concat(tiny_row_area(landscape), "\n\t").concat(xs_spacing(landscape), "\n\t").concat(transparent_frame, "\n}\n.s_row {\n\t").concat(tiny_row_area(landscape), "\n\t").concat(s_spacing(landscape), "\n\t").concat(transparent_frame, "\n}\n.m_row {\n\t").concat(tiny_row_area(landscape), "\n\t").concat(m_spacing(landscape), "\n\t").concat(transparent_frame, "\n}\n.l_row {\n\t").concat(tiny_row_area(landscape), "\n\t").concat(l_spacing(landscape), "\n\t").concat(transparent_frame, "\n}\n.xl_row {\n\t").concat(tiny_row_area(landscape), "\n\t").concat(xl_spacing(landscape), "\n\t").concat(transparent_frame, "\n}\n");
};
//------------------------------------------------------------------------
// CSS
//------------------------------------------------------------------------
var css = "* {\n\toverflow: hidden;\n\tvertical-align: middle;\n}\nbody {\n\t".concat(fullscreen_whole_area, "\n\t").concat(zero_spacing(), "\n\t").concat(s_font, "\n\t").concat(light_color_frame, "\n\ttext-align: ").concat(defaultTextAlign, ";\n\tz-index: 0;\n}\na:link {\n  color: ").concat(mediumColor, ";\n}\na:visited {\n  color: ").concat(mediumColor, ";\n}\na:hover {\n  color: ").concat(lightYellowColor, ";\n}\na:active {\n  color: ").concat(mediumColor, ";\n}\n.dim {\n\t").concat(dim_color_frame, "\n}\n.noTextDeco {\n\ttext-decoration: none;\n}\n.horizontallyCentered {\n\tleft: 50%;\n\ttransform: translate(-50%, 0);\n}\n\n@media (orientation: landscape) {\n\t").concat(stylesForOrientation(true), "\n}\n\n@media (orientation: portrait) {\n\t").concat(stylesForOrientation(false), "\n}");
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (css);


/***/ }),

/***/ "./src/server/util/authUtil.ts":
/*!*************************************!*\
  !*** ./src/server/util/authUtil.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jsonwebtoken */ "jsonwebtoken");
/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jsonwebtoken__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var bcrypt__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! bcrypt */ "bcrypt");
/* harmony import */ var bcrypt__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(bcrypt__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emailUtil__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./emailUtil */ "./src/server/util/emailUtil.ts");
/* harmony import */ var _db_searchDB__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../db/searchDB */ "./src/server/db/searchDB.ts");
/* harmony import */ var _db_authDB__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../db/authDB */ "./src/server/db/authDB.ts");
/* harmony import */ var _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/embeddedScripts/util/textUtil */ "./src/shared/embeddedScripts/util/textUtil.js");
/* harmony import */ var _debugUtil__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../shared/embeddedScripts/config/uiConfig */ "./src/shared/embeddedScripts/config/uiConfig.js");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};









dotenv__WEBPACK_IMPORTED_MODULE_7___default().config();
var dev = process.env.MODE == "dev";
var cyclicCounter = 0;
var AuthUtil = {
    register: function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var emailError, existingUsers, passwordHash, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    if (!validateUserNameAndPassword(req, res))
                        return [2 /*return*/];
                    emailError = _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_5__["default"].findErrorInEmailAddress(req.body.email);
                    if (emailError != null) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Email Input Error", { email: req.body.email, emailError: emailError }, "high", "pink");
                        res.status(400).send(_shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_8__["default"].displayText.message[emailError]);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, _db_searchDB__WEBPACK_IMPORTED_MODULE_3__["default"].users.withUserName(req.body.userName, res)];
                case 1:
                    existingUsers = _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    if (existingUsers && existingUsers.length > 0) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("UserName already exists", { userName: req.body.userName, existingUser: existingUsers[0] }, "high", "pink");
                        res.status(403).send("User \"".concat(req.body.userName, "\" already exists."));
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, _db_searchDB__WEBPACK_IMPORTED_MODULE_3__["default"].users.withEmail(req.body.email, res)];
                case 2:
                    existingUsers = _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    if (existingUsers && existingUsers.length > 0) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("There is already an account with the same email", { email: req.body.email, existingUser: existingUsers[0] }, "high", "pink");
                        res.status(403).send("There is already an account with the email \"".concat(req.body.email, "\"."));
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, _emailUtil__WEBPACK_IMPORTED_MODULE_2__["default"].endEmailVerification(req, res)];
                case 3:
                    _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    return [4 /*yield*/, bcrypt__WEBPACK_IMPORTED_MODULE_1___default().hash(req.body.password, 10)];
                case 4:
                    passwordHash = _a.sent();
                    return [4 /*yield*/, _db_authDB__WEBPACK_IMPORTED_MODULE_4__["default"].registerNewUser(req.body.userName, passwordHash, req.body.email, res)];
                case 5:
                    _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    return [4 /*yield*/, addTokenForRegisteredUser(req.body.userName, res)];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    err_1 = _a.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("User Registration Error", { err: err_1 }, "high", "pink");
                    res.status(500).send("ERROR: Failed to register the user (".concat(err_1, ")."));
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); },
    login: function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user, validPassword, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!validateUserNameAndPassword(req, res))
                        return [2 /*return*/];
                    return [4 /*yield*/, findExistingUserByUserName(req.body.userName, res)];
                case 1:
                    user = _a.sent();
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, bcrypt__WEBPACK_IMPORTED_MODULE_1___default().compare(req.body.password, user.passwordHash)];
                case 2:
                    validPassword = _a.sent();
                    if (!validPassword) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Wrong password", { passwordEntered: (dev ? req.body.password : "(HIDDEN)"), passwordHash: user.passwordHash }, "high", "pink");
                        res.status(401).send("Wrong password.");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, addTokenForRegisteredUser(req.body.userName, res)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Login Error", { err: err_2 }, "high", "pink");
                    res.status(500).send("ERROR: Failed to login (".concat(err_2, ")."));
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); },
    getUserFromToken: function (token) {
        return getUserFromToken(token);
    },
    clearToken: function (req, res) {
        res.clearCookie("thingspool_token").status(200);
    },
    authenticateAdmin: function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, authenticate(req, res, function (user) { return user.userType == "admin"; }, next)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    authenticateRegisteredUser: function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, authenticate(req, res, function (user) { return user.userType == "admin" || user.userType == "member"; }, next)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    authenticateAnyUser: function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, authenticate(req, res, function (_) { return true; }, next)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }
};
function authenticate(req, res, passCondition, next) {
    return __awaiter(this, void 0, void 0, function () {
        var user, _a, err_3, err_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    user = getUserFromReq(req);
                    if (!user) return [3 /*break*/, 9];
                    if (!passCondition(user)) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("User doesn't satisfy the pass-condition.", { user: user }, "high", "pink");
                        res.status(403).send("User doesn't satisfy the pass-condition.");
                        return [2 /*return*/, false];
                    }
                    _a = user.userType;
                    switch (_a) {
                        case "admin": return [3 /*break*/, 1];
                        case "member": return [3 /*break*/, 1];
                        case "guest": return [3 /*break*/, 4];
                    }
                    return [3 /*break*/, 7];
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, addTokenForRegisteredUser(user.userName, res)];
                case 2:
                    _b.sent(); // refresh the token
                    req.user = user;
                    next();
                    return [2 /*return*/, true];
                case 3:
                    err_3 = _b.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Failed to add token (registered user)", { err: err_3 }, "high", "pink");
                    res.status(401).send("Failed to add token (error: ".concat(err_3, ")"));
                    return [2 /*return*/, false];
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, addTokenForGuest(user, res)];
                case 5:
                    _b.sent(); // refresh the token
                    req.user = user;
                    next();
                    return [2 /*return*/, true];
                case 6:
                    err_4 = _b.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Failed to add token (guest)", { err: err_4 }, "high", "pink");
                    res.status(401).send("Failed to add token (error: ".concat(err_4, ")"));
                    return [2 /*return*/, false];
                case 7:
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Unknown user type", { userType: user.userType }, "high", "pink");
                    res.status(500).send("Unknown user type :: ".concat(user.userType));
                    return [2 /*return*/, false];
                case 8: return [3 /*break*/, 10];
                case 9:
                    _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].logRaw("Authentication Failed", "high", "pink");
                    res.status(401).send("Authentication Failed");
                    return [2 /*return*/, false];
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Returns NULL if the token exists but the authentication failed.
// Returns a registered user (admin or member) if the token exists and the authentication succeeded.
// Returns a guest user if the token doesn't exist.
function getUserFromReq(req) {
    var token = req.cookies["thingspool_token"];
    if (token) // Token exists? It means the client has authenticated before.
     {
        // If the token is valid and not expired, the existing user (member) will be returned.
        // Otherwise NULL will be returned, in which case the client should be asked to re-authenticate (i.e. log in).
        return getUserFromToken(token);
    }
    else // Token doesn't exist? It means the client is visiting this web-app the very first time.
     {
        // Since this is the first-time visit, just generate a random user and make a guest-token for it.
        // We will keep using this guest-token until the client creates his/her own account.
        var uniqueInt = ((Math.floor(Date.now() / 1000) - 1757800000) * 10) + cyclicCounter;
        cyclicCounter = (cyclicCounter + 1) % 10;
        var uniqueHex = uniqueInt.toString(16);
        var guestName = "Guest-".concat(uniqueHex);
        return { userID: "0", userName: guestName, userType: "guest", passwordHash: "NO_PASSWORD", email: "NO_EMAIL" };
    }
}
function getUserFromToken(token) {
    try {
        var user = jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().verify(token, process.env.JWT_SECRET_KEY);
        if (user) {
            return user;
        }
        else {
            _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("User is not found in the given token.", { tokenLength: token.length }, "high", "yellow");
            return null;
        }
    }
    catch (err) {
        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Token Verification Failed", { err: err }, "high", "pink");
        return null;
    }
}
function addTokenForGuest(guestUser, res) {
    return __awaiter(this, void 0, void 0, function () {
        var token;
        return __generator(this, function (_a) {
            token = jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().sign(guestUser, process.env.JWT_SECRET_KEY);
            res === null || res === void 0 ? void 0 : res.cookie("thingspool_token", token, {
                secure: dev ? false : true,
                httpOnly: true,
                sameSite: "strict",
                maxAge: 3155692600000, // 100 years
            }).status(201);
            return [2 /*return*/];
        });
    });
}
function addTokenForRegisteredUser(userName, res) {
    return __awaiter(this, void 0, void 0, function () {
        var user, token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findExistingUserByUserName(userName, res)];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Failed to add token (user not found)", { userName: userName }, "high");
                        res === null || res === void 0 ? void 0 : res.status(404).send("Tried to add token, but there is no account with userName \"".concat(userName, "\"."));
                        return [2 /*return*/];
                    }
                    token = jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().sign(user, process.env.JWT_SECRET_KEY);
                    res === null || res === void 0 ? void 0 : res.cookie("thingspool_token", token, {
                        secure: dev ? false : true,
                        httpOnly: true,
                        sameSite: "strict",
                        maxAge: 3155692600000, // 100 years
                    }).status(201);
                    return [2 /*return*/];
            }
        });
    });
}
function findExistingUserByUserName(userName, res) {
    return __awaiter(this, void 0, void 0, function () {
        var existingUsers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, _db_searchDB__WEBPACK_IMPORTED_MODULE_3__["default"].users.withUserName(userName, res)];
                case 1:
                    existingUsers = _a.sent();
                    if (res && (res.statusCode < 200 || res.statusCode >= 300))
                        return [2 /*return*/, null];
                    if (!existingUsers || existingUsers.length == 0) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("User Not Found", { userName: userName }, "high", "pink");
                        res === null || res === void 0 ? void 0 : res.clearCookie("thingspool_token").status(404).send("There is no account with userName \"".concat(userName, "\"."));
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, existingUsers[0]];
            }
        });
    });
}
function validateUserNameAndPassword(req, res) {
    var userNameError = _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_5__["default"].findErrorInUserName(req.body.userName);
    if (userNameError != null) {
        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("UserName Input Error", { userName: req.body.userName, userNameError: userNameError }, "high", "pink");
        res.status(400).send(_shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_8__["default"].displayText.message[userNameError]);
        return false;
    }
    var passwordError = _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_5__["default"].findErrorInPassword(req.body.password);
    if (passwordError != null) {
        _debugUtil__WEBPACK_IMPORTED_MODULE_6__["default"].log("Password Input Error", { password: (dev ? req.body.password : "(HIDDEN)"), passwordError: passwordError }, "high", "pink");
        res.status(400).send(_shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_8__["default"].displayText.message[passwordError]);
        return false;
    }
    return true;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AuthUtil);


/***/ }),

/***/ "./src/server/util/debugUtil.ts":
/*!**************************************!*\
  !*** ./src/server/util/debugUtil.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _sockets_consoleSockets__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../sockets/consoleSockets */ "./src/server/sockets/consoleSockets.ts");

var stackTrace = [];
var DebugUtil = {
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: function (logLevelOrName) {
        DebugUtil.thresholdLogLevel = isNaN(logLevelOrName) ?
            DebugUtil.getLogLevelFromName(logLevelOrName) : logLevelOrName;
    },
    getThresholdLogLevel: function () {
        return DebugUtil.thresholdLogLevel;
    },
    getLogLevelFromName: function (logLevelName) {
        switch (logLevelName) {
            case "low": return 0;
            case "medium": return 1;
            case "high": return 2;
            default: console.error("ERROR: Unknown log level name (\"".concat(logLevelName, "\")"));
        }
        return 0;
    },
    log: function (eventTitle, eventDescObj, logLevelName, highlightColor) {
        if (eventDescObj === void 0) { eventDescObj = undefined; }
        if (logLevelName === void 0) { logLevelName = "high"; }
        var details = "";
        if (eventDescObj != undefined)
            details = JSON.stringify(eventDescObj);
        var origin = DebugUtil.getStackTrace();
        var logLevel = DebugUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= DebugUtil.thresholdLogLevel)
            _sockets_consoleSockets__WEBPACK_IMPORTED_MODULE_0__["default"].log((highlightColor ? "<b style=\"color:".concat(highlightColor, "\">") : "") + eventTitle + (highlightColor ? "</b>" : ""), origin, details);
    },
    logRaw: function (message, logLevelName, highlightColor) {
        if (logLevelName === void 0) { logLevelName = "high"; }
        DebugUtil.log(message, undefined, logLevelName, highlightColor);
    },
    getStackTrace: function () {
        var arr = [];
        for (var i = stackTrace.length - 1; i >= 0; --i)
            arr.push(stackTrace[i]);
        return arr.join(" <- ");
    },
    pushStackTrace: function (traceName) {
        stackTrace.push(traceName);
        DebugUtil.logRaw("pushStackTrace: ".concat(traceName), "high", "gray");
    },
    popStackTrace: function (traceName) {
        if (stackTrace.length == 0) {
            DebugUtil.logRaw("No name to pop in stackTrace :: (traceName = ".concat(traceName, ")"), "high", "pink");
            return;
        }
        var expectedTraceName = stackTrace.pop();
        if (expectedTraceName != traceName) {
            DebugUtil.logRaw("Name mismatch in stackTrace :: (traceName = ".concat(traceName, ", expectedTraceName = ").concat(expectedTraceName, ")"), "high", "pink");
            return;
        }
        DebugUtil.logRaw("popStackTrace: ".concat(traceName), "high", "gray");
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DebugUtil);


/***/ }),

/***/ "./src/server/util/ejsUtil.ts":
/*!************************************!*\
  !*** ./src/server/util/ejsUtil.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _debugUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var _fileUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./fileUtil */ "./src/server/util/fileUtil.ts");
/* harmony import */ var _shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../shared/embeddedScripts/config/uiConfig */ "./src/shared/embeddedScripts/config/uiConfig.js");
/* harmony import */ var _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../shared/embeddedScripts/util/textUtil */ "./src/shared/embeddedScripts/util/textUtil.js");
/* harmony import */ var ejs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ejs */ "ejs");
/* harmony import */ var ejs__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(ejs__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_5__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};






dotenv__WEBPACK_IMPORTED_MODULE_5___default().config();
var ejsPartialRootPath = "".concat(process.env.PWD, "/").concat(process.env.VIEWS_ROOT_DIR, "/partial");
var baseStaticPageEJSParams = {
    TextUtil: _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__["default"],
    UIConfig: _shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_2__["default"],
    ejsPartialRootPath: ejsPartialRootPath,
    isStaticPage: true,
};
var baseDynamicPageEJSParams = {
    TextUtil: _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__["default"],
    UIConfig: _shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_2__["default"],
    ejsPartialRootPath: ejsPartialRootPath,
    isStaticPage: false,
};
var cachedEJSStrings = {};
var EJSUtil = {
    render: function (req, res, ejsViewPath, customEJSParams) {
        res.render(ejsViewPath, EJSUtil.makeEJSParams(req, customEJSParams), function (err, html) {
            if (err) {
                res.status(500).send(err.message);
            }
            else {
                html = EJSUtil.postProcessHTML(html);
                res.status(200).setHeader("content-type", "text/html").send(html);
            }
        });
    },
    postProcessHTML: function (html) {
        if (process.env.MODE == "dev") {
            html = html
                .replaceAll("\n", "!*NEW_LINE*!")
                .replace(/(PROD_CODE_BEGIN).*?(PROD_CODE_END)/g, "REMOVED_PROD_CODE")
                .replaceAll("!*NEW_LINE*!", "\n")
                .replaceAll(process.env.URL_STATIC, "http://localhost:".concat(process.env.PORT)) // In dev mode, the dynamic server will also play the role of the static server simultaneously.
                .replaceAll(process.env.URL_DYNAMIC, "http://localhost:".concat(process.env.PORT));
            return html;
        }
        else {
            return html;
        }
    },
    makeEJSParams: function (req, customEJSParams) {
        var mergedEJSParams = {};
        Object.assign(mergedEJSParams, baseDynamicPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);
        if (mergedEJSParams.user)
            _debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("'user' shouldn't be defined manually in EJS params.", { mergedEJSParams: mergedEJSParams }, "high", "pink");
        mergedEJSParams.user = req.user;
        if (mergedEJSParams.globalDictionary)
            _debugUtil__WEBPACK_IMPORTED_MODULE_0__["default"].log("'globalDictionary' shouldn't be defined manually in EJS params.", { mergedEJSParams: mergedEJSParams }, "high", "pink");
        mergedEJSParams.globalDictionary = {};
        return mergedEJSParams;
    },
    makeEJSParamsStatic: function (customEJSParams) {
        var mergedEJSParams = {};
        Object.assign(mergedEJSParams, baseStaticPageEJSParams);
        Object.assign(mergedEJSParams, customEJSParams);
        return mergedEJSParams;
    },
    createStaticHTMLFromEJS: function (relativeEJSFilePath_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([relativeEJSFilePath_1], args_1, true), void 0, function (relativeEJSFilePath, customEJSParams) {
            var ejsString, template, htmlString;
            if (customEJSParams === void 0) { customEJSParams = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ejsString = cachedEJSStrings[relativeEJSFilePath];
                        if (!(ejsString == undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, _fileUtil__WEBPACK_IMPORTED_MODULE_1__["default"].read(relativeEJSFilePath, process.env.VIEWS_ROOT_DIR)];
                    case 1:
                        ejsString = _a.sent();
                        cachedEJSStrings[relativeEJSFilePath] = ejsString;
                        _a.label = 2;
                    case 2:
                        template = ejs__WEBPACK_IMPORTED_MODULE_4___default().compile(ejsString);
                        htmlString = template(EJSUtil.makeEJSParamsStatic(customEJSParams));
                        return [2 /*return*/, htmlString];
                }
            });
        });
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EJSUtil);


/***/ }),

/***/ "./src/server/util/emailUtil.ts":
/*!**************************************!*\
  !*** ./src/server/util/emailUtil.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! crypto */ "crypto");
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var nodemailer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! nodemailer */ "nodemailer");
/* harmony import */ var nodemailer__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(nodemailer__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _db_emailDB__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../db/emailDB */ "./src/server/db/emailDB.ts");
/* harmony import */ var _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../shared/embeddedScripts/util/textUtil */ "./src/shared/embeddedScripts/util/textUtil.js");
/* harmony import */ var _debugUtil__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var _shared_embeddedScripts_config_globalConfig__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/embeddedScripts/config/globalConfig */ "./src/shared/embeddedScripts/config/globalConfig.js");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../shared/embeddedScripts/config/uiConfig */ "./src/shared/embeddedScripts/config/uiConfig.js");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};








dotenv__WEBPACK_IMPORTED_MODULE_6___default().config();
var codeChars = "0123456789";
var EmailUtil = {
    startEmailVerification: function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var emailError, existingV, verificationCode, transporter, mailOptions, sendResult, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, _db_emailDB__WEBPACK_IMPORTED_MODULE_2__["default"].verifications.deleteExpired(Math.floor(Date.now() * 0.001), res)];
                case 1:
                    _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    emailError = _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__["default"].findErrorInEmailAddress(req.body.email);
                    if (emailError != null) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email Input Error", { email: req.body.email, emailError: emailError }, "high", "pink");
                        res.status(400).send(_shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_7__["default"].displayText.message[emailError]);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, _db_emailDB__WEBPACK_IMPORTED_MODULE_2__["default"].verifications.selectByEmail(req.body.email, res)];
                case 2:
                    existingV = _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    if (existingV && existingV.length > 0) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email is already undergoing verification", { email: req.body.email }, "high", "pink");
                        res.status(403).send("Email \"".concat(req.body.email, "\" is already undergoing verification."));
                        return [2 /*return*/];
                    }
                    verificationCode = new Array(8)
                        .fill(null)
                        .map(function () { return codeChars.charAt(crypto__WEBPACK_IMPORTED_MODULE_0___default().randomInt(codeChars.length)); })
                        .join("");
                    return [4 /*yield*/, _db_emailDB__WEBPACK_IMPORTED_MODULE_2__["default"].verifications.insert(req.body.email, verificationCode, Math.floor(Date.now() * 0.001) + _shared_embeddedScripts_config_globalConfig__WEBPACK_IMPORTED_MODULE_5__["default"].auth.emailVerificationTimeoutInSeconds, res)];
                case 3:
                    _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    if (!_shared_embeddedScripts_config_globalConfig__WEBPACK_IMPORTED_MODULE_5__["default"].auth.bypassEmailVerification) return [3 /*break*/, 4];
                    _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email transmission bypassed", { email: req.body.email }, "low");
                    res.status(201).send(verificationCode);
                    return [3 /*break*/, 8];
                case 4:
                    transporter = nodemailer__WEBPACK_IMPORTED_MODULE_1___default().createTransport({
                        service: "naver",
                        host: "smtp.naver.com",
                        auth: {
                            user: "pinkroom77@naver.com",
                            pass: process.env.EMAIL_SENDER_PASS,
                        },
                    });
                    mailOptions = {
                        from: "pinkroom77@naver.com",
                        to: req.body.email,
                        subject: "Here is your email verification code.",
                        text: "Your verification code is ".concat(verificationCode),
                    };
                    return [4 /*yield*/, transporter.sendMail(mailOptions)];
                case 5:
                    sendResult = _a.sent();
                    transporter.close();
                    if (!sendResult.accepted) return [3 /*break*/, 6];
                    _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email sent", { email: req.body.email }, "low");
                    res.sendStatus(201);
                    return [3 /*break*/, 8];
                case 6:
                    _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email failed to be sent", { email: req.body.email }, "high", "pink");
                    return [4 /*yield*/, _db_emailDB__WEBPACK_IMPORTED_MODULE_2__["default"].verifications.updateExpirationTime(req.body.email, Math.floor(Date.now() * 0.001) + 120, // block retry for 2 minutes (to prevent spamming)
                        res)];
                case 7:
                    _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    res.status(500).send("Error while sending the verification code to \"".concat(req.body.email, "\". Please try again after 2 minutes."));
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    err_1 = _a.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email Verification Start Error", { err: err_1 }, "high", "pink");
                    res.status(500).send("ERROR: Failed to start email verification (".concat(err_1, ")."));
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    }); },
    endEmailVerification: function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var emailError, verificationCode, existingV;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    emailError = _shared_embeddedScripts_util_textUtil__WEBPACK_IMPORTED_MODULE_3__["default"].findErrorInEmailAddress(req.body.email);
                    if (emailError != null) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Email Input Error", { email: req.body.email, emailError: emailError }, "high", "pink");
                        res.status(400).send(_shared_embeddedScripts_config_uiConfig__WEBPACK_IMPORTED_MODULE_7__["default"].displayText.message[emailError]);
                        return [2 /*return*/];
                    }
                    verificationCode = req.body.verificationCode;
                    return [4 /*yield*/, _db_emailDB__WEBPACK_IMPORTED_MODULE_2__["default"].verifications.selectByEmail(req.body.email, res)];
                case 1:
                    existingV = _a.sent();
                    if (res.statusCode < 200 || res.statusCode >= 300)
                        return [2 /*return*/];
                    if (!existingV || existingV.length == 0) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("No pending email verification found", { email: req.body.email }, "high", "pink");
                        res.status(404).send("No pending verification found for email \"".concat(req.body.email, "\"."));
                        return [2 /*return*/];
                    }
                    if (existingV[0].verificationCode != verificationCode) {
                        _debugUtil__WEBPACK_IMPORTED_MODULE_4__["default"].log("Verification Code Mismatch (code entered = '".concat(verificationCode, "')"), { email: req.body.email, actualCode: existingV[0].verificationCode, enteredCode: verificationCode }, "high", "pink");
                        res.status(403).send("Wrong verification code for email \"".concat(req.body.email, "\"."));
                        return [2 /*return*/];
                    }
                    res.status(202);
                    return [2 /*return*/];
            }
        });
    }); },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmailUtil);


/***/ }),

/***/ "./src/server/util/fileUtil.ts":
/*!*************************************!*\
  !*** ./src/server/util/fileUtil.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! path */ "path");
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var fs_promises__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! fs/promises */ "fs/promises");
/* harmony import */ var fs_promises__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs_promises__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _debugUtil__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./debugUtil */ "./src/server/util/debugUtil.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_3__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




dotenv__WEBPACK_IMPORTED_MODULE_3___default().config();
var FileUtil = {
    read: function (relativeFilePath, rootDir) { return __awaiter(void 0, void 0, void 0, function () {
        var absoluteFilePath, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
                    return [4 /*yield*/, fs_promises__WEBPACK_IMPORTED_MODULE_1___default().readFile(absoluteFilePath, { encoding: 'utf8' })];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data];
                case 2:
                    err_1 = _a.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].log("Failed to read file", { relativeFilePath: relativeFilePath, err: err_1 }, "high", "pink");
                    return [2 /*return*/, ""];
                case 3: return [2 /*return*/];
            }
        });
    }); },
    write: function (relativeFilePath, content, rootDir) { return __awaiter(void 0, void 0, void 0, function () {
        var absoluteFilePath, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
                    //console.log(`Writing ---> ${absoluteFilePath}`);
                    return [4 /*yield*/, fs_promises__WEBPACK_IMPORTED_MODULE_1___default().writeFile(absoluteFilePath, content)];
                case 1:
                    //console.log(`Writing ---> ${absoluteFilePath}`);
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    _debugUtil__WEBPACK_IMPORTED_MODULE_2__["default"].log("Failed to write file", { relativeFilePath: relativeFilePath, err: err_2 }, "high", "pink");
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); },
    getAllRelativePathsInDirRecursively: function (dir) { return __awaiter(void 0, void 0, void 0, function () {
        var absoluteDirPath, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    absoluteDirPath = path__WEBPACK_IMPORTED_MODULE_0___default().join(process.env.PWD, dir);
                    result = [];
                    return [4 /*yield*/, FileUtil.getAllRelativePathsInDirRecursively_internal(absoluteDirPath, [], result)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, result];
            }
        });
    }); },
    getAbsoluteFilePath: function (relativeFilePath, rootDir) {
        if (rootDir == undefined)
            rootDir = process.env.STATIC_PAGE_ROOT_DIR;
        return path__WEBPACK_IMPORTED_MODULE_0___default().join(process.env.PWD, rootDir + "/" + relativeFilePath);
    },
    getAllRelativePathsInDirRecursively_internal: function (absoluteDirPath, subDirs, result) {
        return __awaiter(this, void 0, void 0, function () {
            var fileNames, _i, fileNames_1, fileName, subDirsNew, absoluteFilePath, lstat;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_promises__WEBPACK_IMPORTED_MODULE_1___default().readdir(absoluteDirPath)];
                    case 1:
                        fileNames = _a.sent();
                        _i = 0, fileNames_1 = fileNames;
                        _a.label = 2;
                    case 2:
                        if (!(_i < fileNames_1.length)) return [3 /*break*/, 7];
                        fileName = fileNames_1[_i];
                        subDirsNew = subDirs.concat(fileName);
                        absoluteFilePath = "".concat(absoluteDirPath, "/").concat(fileName);
                        return [4 /*yield*/, fs_promises__WEBPACK_IMPORTED_MODULE_1___default().lstat(absoluteFilePath)];
                    case 3:
                        lstat = _a.sent();
                        if (!lstat.isFile()) return [3 /*break*/, 4];
                        result.push(subDirsNew.join("/"));
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, FileUtil.getAllRelativePathsInDirRecursively_internal(absoluteFilePath, subDirsNew, result)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FileUtil);


/***/ }),

/***/ "./src/server/util/networkUtil.ts":
/*!****************************************!*\
  !*** ./src/server/util/networkUtil.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_0__);

dotenv__WEBPACK_IMPORTED_MODULE_0___default().config();
var NetworkUtil = {
    onRouteResponse: function (res, resJSON) {
        if (resJSON === void 0) { resJSON = undefined; }
        if (res.statusCode >= 200 && res.statusCode <= 299) {
            // End response if its status is OK
            if (resJSON)
                res.json(resJSON);
            else
                res.end();
        }
    },
    getErrorPageURL: function (errorPageName) {
        return "".concat(process.env.MODE == "dev" ? "http://localhost:".concat(process.env.PORT) : process.env.URL_STATIC, "/error/").concat(errorPageName, ".html");
    },
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NetworkUtil);


/***/ }),

/***/ "./src/shared/embeddedScripts/config/globalConfig.js":
/*!***********************************************************!*\
  !*** ./src/shared/embeddedScripts/config/globalConfig.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const GlobalConfig =
{
    auth: {
        bypassEmailVerification: false,
        emailVerificationTimeoutInSeconds: 600,
    },
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GlobalConfig);

/***/ }),

/***/ "./src/shared/embeddedScripts/config/uiConfig.js":
/*!*******************************************************!*\
  !*** ./src/shared/embeddedScripts/config/uiConfig.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const UIConfig =
{
    displayText: {
        pageName: {
            "index": "Home", // static
            "arcade": "Arcade", // static
            "library": "Library", // static
            "portfolio": "Portfolio", // static
            "register": "Create Account", // dynamic
            "login": "Log In", // dynamic
            "mypage": "Portal", // dynamic
        },
        message: {
            "error/userName/length": "Username must be between 4 and 16 characters long.",
            "error/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
            "error/password/length": "Password must be between 6 and 24 characters long.",
            "error/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
            "error/email/length": "Email address must not contain more than 64 characters.",
            "error/email/chars": "Please enter a valid email address.",
            "error/roomName/length": "Room name must be between 4 and 64 characters long.",
            "error/roomName/chars": "Room name can only contain alphabets, numbers, spaces, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",

            "rule/userName/length": "Username must be between 4 and 16 characters long.",
            "rule/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
            "rule/password/length": "Password must be between 6 and 24 characters long.",
            "rule/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
            "rule/email/length": "Email address must not contain more than 64 characters.",
            "rule/roomName/length": "Room name must be between 4 and 64 characters long.",
            "rule/roomName/chars": "Room name can only contain alphabets, numbers, spaces, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
        },
    },
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UIConfig);

/***/ }),

/***/ "./src/shared/embeddedScripts/util/textUtil.js":
/*!*****************************************************!*\
  !*** ./src/shared/embeddedScripts/util/textUtil.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const TextUtil =
{
    // character escape

    escapeHTMLChars: (text) =>
    {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replaceAll("\n", "<br>")
            .replaceAll(" ", "&nbsp;");
    },

    // input validation

    findErrorInUserName: (text) =>
    {
        if (text.length < 4 || text.length > 16)
            return "error/userName/length";
        if (text != TextUtil.sanitizeUserName(text))
            return "error/userName/chars";
        return null;
    },
    findErrorInPassword: (text) =>
    {
        if (text.length < 6 || text.length > 24)
            return "error/password/length";
        if (text != TextUtil.sanitizePassword(text))
            return "error/password/chars";
        return null;
    },
    findErrorInEmailAddress: (text) =>
    {
        if (text.length > 64)
            return "error/email/length";
        const regex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
        if (!regex.test(text))
            return "error/email/chars"
        return null;
    },
    findErrorInRoomName: (text) =>
    {
        if (text.length < 4 || text.length > 64)
            return "error/roomName/length";
        if (text != TextUtil.sanitizeRoomName(text))
            return "error/roomName/chars";
        return null;
    },
    
    sanitizeUserName: (text) =>
    {
        if (text.length > 16)
            text = text.substring(0, 16);
        return text.replace(/[^a-zA-Z0-9_]/g, "");
    },
    sanitizePassword: (text) =>
    {
        if (text.length > 24)
            text = text.substring(0, 24);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/]/g, "");
    },
    sanitizeRoomName: (text) =>
    {
        return TextUtil.sanitizeRoomNameWithoutTrimming(text).trim();
    },
    sanitizeRoomNameWithoutTrimming: (text) =>
    {
        if (text.length > 64)
            text = text.substring(0, 64);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/\s]/g, "")
            .replace(/\s+/g, " "); // replace multiple consecutive spaces with a single space.
    },
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TextUtil);

/***/ }),

/***/ "bcrypt":
/*!*************************!*\
  !*** external "bcrypt" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("bcrypt");

/***/ }),

/***/ "body-parser":
/*!******************************!*\
  !*** external "body-parser" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("body-parser");

/***/ }),

/***/ "cookie":
/*!*************************!*\
  !*** external "cookie" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("cookie");

/***/ }),

/***/ "cookie-parser":
/*!********************************!*\
  !*** external "cookie-parser" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("cookie-parser");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "dotenv":
/*!*************************!*\
  !*** external "dotenv" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("dotenv");

/***/ }),

/***/ "ejs":
/*!**********************!*\
  !*** external "ejs" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("ejs");

/***/ }),

/***/ "express":
/*!**************************!*\
  !*** external "express" ***!
  \**************************/
/***/ ((module) => {

module.exports = require("express");

/***/ }),

/***/ "fs/promises":
/*!******************************!*\
  !*** external "fs/promises" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("fs/promises");

/***/ }),

/***/ "hpp":
/*!**********************!*\
  !*** external "hpp" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("hpp");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "jsonwebtoken":
/*!*******************************!*\
  !*** external "jsonwebtoken" ***!
  \*******************************/
/***/ ((module) => {

module.exports = require("jsonwebtoken");

/***/ }),

/***/ "mysql2/promise":
/*!*********************************!*\
  !*** external "mysql2/promise" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("mysql2/promise");

/***/ }),

/***/ "nodemailer":
/*!*****************************!*\
  !*** external "nodemailer" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("nodemailer");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "socket.io":
/*!****************************!*\
  !*** external "socket.io" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("socket.io");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!******************************!*\
  !*** ./src/server/server.ts ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! express */ "express");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(express__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! http */ "http");
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(http__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var body_parser__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! body-parser */ "body-parser");
/* harmony import */ var body_parser__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(body_parser__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var cookie_parser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! cookie-parser */ "cookie-parser");
/* harmony import */ var cookie_parser__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(cookie_parser__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var hpp__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! hpp */ "hpp");
/* harmony import */ var hpp__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(hpp__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _ssg_ssg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./ssg/ssg */ "./src/server/ssg/ssg.ts");
/* harmony import */ var _db_db__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./db/db */ "./src/server/db/db.ts");
/* harmony import */ var _router_router__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./router/router */ "./src/server/router/router.ts");
/* harmony import */ var _sockets_sockets__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./sockets/sockets */ "./src/server/sockets/sockets.ts");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! dotenv */ "dotenv");
/* harmony import */ var dotenv__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(dotenv__WEBPACK_IMPORTED_MODULE_9__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};










dotenv__WEBPACK_IMPORTED_MODULE_9___default().config();
function Server() {
    return __awaiter(this, void 0, void 0, function () {
        var app, server;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.MODE == "dev")) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0,_ssg_ssg__WEBPACK_IMPORTED_MODULE_5__["default"])()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    if (!(process.env.MODE == "ssg")) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0,_ssg_ssg__WEBPACK_IMPORTED_MODULE_5__["default"])()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4: 
                // database initialization
                return [4 /*yield*/, _db_db__WEBPACK_IMPORTED_MODULE_6__["default"].runSQLFile("clear.sql")];
                case 5:
                    // database initialization
                    _a.sent(); // <--- TODO: Remove this once the data migration system gets implemented.
                    return [4 /*yield*/, _db_db__WEBPACK_IMPORTED_MODULE_6__["default"].runSQLFile("init.sql")];
                case 6:
                    _a.sent();
                    app = express__WEBPACK_IMPORTED_MODULE_0___default()();
                    server = http__WEBPACK_IMPORTED_MODULE_1___default().createServer(app);
                    // config
                    app.set("view engine", "ejs");
                    // middleware
                    app.use(body_parser__WEBPACK_IMPORTED_MODULE_2___default().json());
                    app.use(body_parser__WEBPACK_IMPORTED_MODULE_2___default().urlencoded({ extended: true }));
                    app.use(cookie_parser__WEBPACK_IMPORTED_MODULE_3___default()());
                    app.use(hpp__WEBPACK_IMPORTED_MODULE_4___default()()); // for HTTP parameter pollution prevention
                    // router
                    (0,_router_router__WEBPACK_IMPORTED_MODULE_7__["default"])(app);
                    // server connection
                    server.listen(process.env.PORT, function () {
                        console.log("---------------------------------------------");
                        console.log("Listening to port ".concat(process.env.PORT, "."));
                    });
                    // socket connection
                    (0,_sockets_sockets__WEBPACK_IMPORTED_MODULE_8__["default"])(server);
                    return [2 /*return*/];
            }
        });
    });
}
Server();

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBRTlCLGFBQWE7b0JBQ2IsR0FBRyxDQUFDLEdBQUcsQ0FBQyx1REFBZSxFQUFFLENBQUMsQ0FBQztvQkFDM0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyw2REFBcUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ25ELEdBQUcsQ0FBQyxHQUFHLENBQUMsb0RBQVksRUFBRSxDQUFDLENBQUM7b0JBQ3hCLEdBQUcsQ0FBQyxHQUFHLENBQUMsMENBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQywwQ0FBMEM7b0JBRTFELFNBQVM7b0JBQ1QsMERBQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFWixvQkFBb0I7b0JBQ3BCLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUU7d0JBQzVCLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0NBQStDLENBQUMsQ0FBQzt3QkFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBcUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQUcsQ0FBQyxDQUFDO29CQUMxRCxDQUFDLENBQUMsQ0FBQztvQkFFSCxvQkFBb0I7b0JBQ3BCLDREQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7O0NBQ25CO0FBRUQsTUFBTSxFQUFFLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvZGIvYXV0aERCLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci9kYi9kYi50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvZGIvZW1haWxEQi50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvZGIvc2VhcmNoREIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL2RiL3R5cGVzL3F1ZXJ5LnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci9kYi90eXBlcy90cmFuc2FjdGlvbi50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvcm91dGVyL2FwaS9hdXRoUm91dGVyLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci9yb3V0ZXIvcm91dGVyLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci9yb3V0ZXIvdWkvcGFnZVJvdXRlci50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc29ja2V0cy9jb25zb2xlU29ja2V0cy50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc29ja2V0cy9nYW1lU29ja2V0cy50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc29ja2V0cy9zb2NrZXRzLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci9zc2cvYnVpbGRlci9hdG9tRmVlZEJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL2VtYmVkZGVkU2NyaXB0QnVpbGRlci50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc3NnL2J1aWxkZXIvcGFnZS9hcmNhZGVHYW1lUGFnZUJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL3BhZ2UvYXJjYWRlUGFnZUJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL3BhZ2UvZXJyb3JQYWdlQnVpbGRlci50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc3NnL2J1aWxkZXIvcGFnZS9saWJyYXJ5UGFnZUJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL3BhZ2UvbGlicmFyeVBvc3RMaXN0UGFnZUJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL3BhZ2UvbGlicmFyeVBvc3RQYWdlQnVpbGRlci50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc3NnL2J1aWxkZXIvc2l0ZW1hcEJ1aWxkZXIudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9idWlsZGVyL3RleHRGaWxlQnVpbGRlci50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc3NnL2RhdGEvYXJjYWRlRGF0YS50cyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc3NnL2RhdGEvbGlicmFyeURhdGEudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9zc2cudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3NzZy9zdHlsZS9zdHlsZURpY3Rpb25hcnkudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3V0aWwvYXV0aFV0aWwudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3V0aWwvZGVidWdVdGlsLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci91dGlsL2Vqc1V0aWwudHMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vLi9zcmMvc2VydmVyL3V0aWwvZW1haWxVdGlsLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci91dGlsL2ZpbGVVdGlsLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NlcnZlci91dGlsL25ldHdvcmtVdGlsLnRzIiwid2VicGFjazovL3lvdW5namluLy4vc3JjL3NoYXJlZC9lbWJlZGRlZFNjcmlwdHMvY29uZmlnL2dsb2JhbENvbmZpZy5qcyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zaGFyZWQvZW1iZWRkZWRTY3JpcHRzL2NvbmZpZy91aUNvbmZpZy5qcyIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zaGFyZWQvZW1iZWRkZWRTY3JpcHRzL3V0aWwvdGV4dFV0aWwuanMiLCJ3ZWJwYWNrOi8veW91bmdqaW4vZXh0ZXJuYWwgY29tbW9uanMgXCJiY3J5cHRcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBjb21tb25qcyBcImJvZHktcGFyc2VyXCIiLCJ3ZWJwYWNrOi8veW91bmdqaW4vZXh0ZXJuYWwgY29tbW9uanMgXCJjb29raWVcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBjb21tb25qcyBcImNvb2tpZS1wYXJzZXJcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBub2RlLWNvbW1vbmpzIFwiY3J5cHRvXCIiLCJ3ZWJwYWNrOi8veW91bmdqaW4vZXh0ZXJuYWwgY29tbW9uanMgXCJkb3RlbnZcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBjb21tb25qcyBcImVqc1wiIiwid2VicGFjazovL3lvdW5namluL2V4dGVybmFsIGNvbW1vbmpzIFwiZXhwcmVzc1wiIiwid2VicGFjazovL3lvdW5namluL2V4dGVybmFsIG5vZGUtY29tbW9uanMgXCJmcy9wcm9taXNlc1wiIiwid2VicGFjazovL3lvdW5namluL2V4dGVybmFsIGNvbW1vbmpzIFwiaHBwXCIiLCJ3ZWJwYWNrOi8veW91bmdqaW4vZXh0ZXJuYWwgbm9kZS1jb21tb25qcyBcImh0dHBcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBjb21tb25qcyBcImpzb253ZWJ0b2tlblwiIiwid2VicGFjazovL3lvdW5namluL2V4dGVybmFsIGNvbW1vbmpzIFwibXlzcWwyL3Byb21pc2VcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBjb21tb25qcyBcIm5vZGVtYWlsZXJcIiIsIndlYnBhY2s6Ly95b3VuZ2ppbi9leHRlcm5hbCBub2RlLWNvbW1vbmpzIFwicGF0aFwiIiwid2VicGFjazovL3lvdW5namluL2V4dGVybmFsIGNvbW1vbmpzIFwic29ja2V0LmlvXCIiLCJ3ZWJwYWNrOi8veW91bmdqaW4vd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8veW91bmdqaW4vd2VicGFjay9ydW50aW1lL2NvbXBhdCBnZXQgZGVmYXVsdCBleHBvcnQiLCJ3ZWJwYWNrOi8veW91bmdqaW4vd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3lvdW5namluL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8veW91bmdqaW4vd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly95b3VuZ2ppbi8uL3NyYy9zZXJ2ZXIvc2VydmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBEQiBmcm9tIFwiLi9kYlwiO1xuaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgVXNlciBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzL2RiL3VzZXJcIjtcbmRvdGVudi5jb25maWcoKTtcblxuY29uc3QgQXV0aERCID1cbntcbiAgICByZWdpc3Rlck5ld1VzZXI6IGFzeW5jICh1c2VyTmFtZTogc3RyaW5nLFxuICAgICAgICBwYXNzd29yZEhhc2g6IHN0cmluZywgZW1haWw6IHN0cmluZywgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFVzZXJbXT4gPT5cbiAgICB7XG4gICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8VXNlcj4oXG4gICAgICAgICAgICBcIklOU0VSVCBJTlRPIHVzZXJzICh1c2VyTmFtZSwgdXNlclR5cGUsIHBhc3N3b3JkSGFzaCwgZW1haWwpIFZBTFVFUyAoPywgPywgPywgPyk7XCIsXG4gICAgICAgICAgICBbdXNlck5hbWUsIFwibWVtYmVyXCIsIHBhc3N3b3JkSGFzaCwgZW1haWxdXG4gICAgICAgICkucnVuKHJlcywgXCJBdXRoREIucmVnaXN0ZXJOZXdVc2VyXCIpO1xuICAgIH0sXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF1dGhEQjsiLCJpbXBvcnQgbXlzcWwgZnJvbSBcIm15c3FsMi9wcm9taXNlXCI7XG5pbXBvcnQgRmlsZVV0aWwgZnJvbSBcIi4uL3V0aWwvZmlsZVV0aWxcIjtcbmltcG9ydCBEZWJ1Z1V0aWwgZnJvbSBcIi4uL3V0aWwvZGVidWdVdGlsXCI7XG5pbXBvcnQgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcbmltcG9ydCBRdWVyeSBmcm9tIFwiLi90eXBlcy9xdWVyeVwiO1xuaW1wb3J0IFRyYW5zYWN0aW9uIGZyb20gXCIuL3R5cGVzL3RyYW5zYWN0aW9uXCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IGRldiA9IHByb2Nlc3MuZW52Lk1PREUgPT0gXCJkZXZcIjtcbmxldCBwb29sOiBteXNxbC5Qb29sIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5jb25zdCBEQiA9XG57XG4gICAgY3JlYXRlUG9vbDogKCk6IHZvaWQgPT5cbiAgICB7XG4gICAgICAgIGlmIChwb29sKVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nUmF3KFwiREIgY29ubmVjdGlvbiBwb29sIGlzIGFscmVhZHkgY3JlYXRlZC5cIiwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwb29sID0gbXlzcWwuY3JlYXRlUG9vbCh7XG4gICAgICAgICAgICBob3N0OiBkZXYgPyBwcm9jZXNzLmVudi5TUUxfSE9TVF9ERVYgOiBwcm9jZXNzLmVudi5TUUxfSE9TVF9QUk9ELFxuICAgICAgICAgICAgdXNlcjogZGV2ID8gcHJvY2Vzcy5lbnYuU1FMX1VTRVJfREVWIDogcHJvY2Vzcy5lbnYuU1FMX1VTRVJfUFJPRCxcbiAgICAgICAgICAgIHBhc3N3b3JkOiBkZXYgPyBwcm9jZXNzLmVudi5TUUxfUEFTU19ERVYgOiBwcm9jZXNzLmVudi5TUUxfUEFTU19QUk9ELFxuICAgICAgICAgICAgZGF0YWJhc2U6IFwibWFpblwiLFxuICAgICAgICAgICAgd2FpdEZvckNvbm5lY3Rpb25zOiB0cnVlLFxuICAgICAgICAgICAgY29ubmVjdGlvbkxpbWl0OiAxMCxcbiAgICAgICAgICAgIHF1ZXVlTGltaXQ6IDAsXG4gICAgICAgICAgICBlbmFibGVLZWVwQWxpdmU6IHRydWUsXG4gICAgICAgICAgICBrZWVwQWxpdmVJbml0aWFsRGVsYXk6IDAsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIXBvb2wpXG4gICAgICAgIHtcbiAgICAgICAgICAgIERlYnVnVXRpbC5sb2dSYXcoXCJGYWlsZWQgdG8gY3JlYXRlIGEgREIgY29ubmVjdGlvbiBwb29sLlwiLCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBtYWtlUXVlcnk6IDxSZXR1cm5UeXBlPihxdWVyeVN0cjogc3RyaW5nLCBxdWVyeVBhcmFtcz86IHN0cmluZ1tdKTogUXVlcnk8UmV0dXJuVHlwZT4gPT5cbiAgICB7XG4gICAgICAgIGlmICghcG9vbClcbiAgICAgICAgICAgIERCLmNyZWF0ZVBvb2woKTtcbiAgICAgICAgcmV0dXJuIG5ldyBRdWVyeTxSZXR1cm5UeXBlPihwb29sISwgcXVlcnlTdHIsIHF1ZXJ5UGFyYW1zKTtcbiAgICB9LFxuICAgIG1ha2VUcmFuc2FjdGlvbjogKHF1ZXJpZXM6IFF1ZXJ5PHZvaWQ+W10pOiBUcmFuc2FjdGlvbiA9PlxuICAgIHtcbiAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvbihwb29sISwgcXVlcmllcyk7XG4gICAgfSxcbiAgICBydW5TUUxGaWxlOiBhc3luYyAoZmlsZU5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT5cbiAgICB7XG4gICAgICAgIERlYnVnVXRpbC5sb2coXCJPcGVuaW5nIFNRTCBGaWxlXCIsIHtmaWxlTmFtZX0sIFwiaGlnaFwiKTtcbiAgICAgICAgY29uc3Qgc3FsID0gYXdhaXQgRmlsZVV0aWwucmVhZChmaWxlTmFtZSwgXCJzcWxcIik7XG4gICAgICAgIGNvbnN0IHNxbFN0YXRlbWVudHMgPSBzcWwuc3BsaXQoXCI7XCIpLm1hcCh4ID0+IHgudHJpbSgpICsgXCI7XCIpLmZpbHRlcih4ID0+IHgubGVuZ3RoID4gMSk7XG4gICAgICAgIGxldCBjb25uOiBteXNxbC5Db25uZWN0aW9uIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25uID0gYXdhaXQgbXlzcWwuY3JlYXRlQ29ubmVjdGlvbih7XG4gICAgICAgICAgICAgICAgaG9zdDogZGV2ID8gcHJvY2Vzcy5lbnYuU1FMX0hPU1RfREVWIDogcHJvY2Vzcy5lbnYuU1FMX0hPU1RfUFJPRCxcbiAgICAgICAgICAgICAgICB1c2VyOiBkZXYgPyBwcm9jZXNzLmVudi5TUUxfVVNFUl9ERVYgOiBwcm9jZXNzLmVudi5TUUxfVVNFUl9QUk9ELFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiBkZXYgPyBwcm9jZXNzLmVudi5TUUxfUEFTU19ERVYgOiBwcm9jZXNzLmVudi5TUUxfUEFTU19QUk9ELFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25uPy5jb25uZWN0KCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNxbFN0YXRlbWVudCBvZiBzcWxTdGF0ZW1lbnRzKVxuICAgICAgICAgICAgICAgIGF3YWl0IGNvbm4/LnF1ZXJ5KHNxbFN0YXRlbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBGaWxlIEV4ZWN1dGlvbiBFcnJvclwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgfVxuICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgIGNvbm4/LmVuZCgpO1xuICAgICAgICB9XG4gICAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgREI7IiwiaW1wb3J0IERCIGZyb20gXCIuL2RiXCI7XG5pbXBvcnQgRW1haWxWZXJpZmljYXRpb24gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlcy9kYi9lbWFpbFZlcmlmaWNhdGlvblwiO1xuaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IEVtYWlsREIgPVxue1xuICAgIHZlcmlmaWNhdGlvbnM6IHtcbiAgICAgICAgc2VsZWN0QnlFbWFpbDogYXN5bmMgKGVtYWlsOiBzdHJpbmcsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxFbWFpbFZlcmlmaWNhdGlvbltdPiA9PlxuICAgICAgICB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgREIubWFrZVF1ZXJ5PEVtYWlsVmVyaWZpY2F0aW9uPihcbiAgICAgICAgICAgICAgICBcIlNFTEVDVCAqIEZST00gZW1haWxWZXJpZmljYXRpb25zIFdIRVJFIGVtYWlsID0gPztcIixcbiAgICAgICAgICAgICAgICBbZW1haWxdXG4gICAgICAgICAgICApLnJ1bihyZXMsIFwiRW1haWxEQi52ZXJpZmljYXRpb25zLnNlbGVjdEJ5RW1haWxcIik7XG4gICAgICAgIH0sXG4gICAgICAgIGluc2VydDogYXN5bmMgKGVtYWlsOiBzdHJpbmcsIHZlcmlmaWNhdGlvbkNvZGU6IHN0cmluZywgZXhwaXJhdGlvblRpbWU6IG51bWJlcixcbiAgICAgICAgICAgIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PlxuICAgICAgICB7XG4gICAgICAgICAgICBhd2FpdCBEQi5tYWtlUXVlcnk8YW55PihcbiAgICAgICAgICAgICAgICBcIklOU0VSVCBJTlRPIGVtYWlsVmVyaWZpY2F0aW9ucyAoZW1haWwsIHZlcmlmaWNhdGlvbkNvZGUsIGV4cGlyYXRpb25UaW1lKSBWQUxVRVMgKD8sID8sID8pO1wiLFxuICAgICAgICAgICAgICAgIFtlbWFpbCwgdmVyaWZpY2F0aW9uQ29kZSwgZXhwaXJhdGlvblRpbWUudG9TdHJpbmcoKV1cbiAgICAgICAgICAgICkucnVuKHJlcywgXCJFbWFpbERCLnZlcmlmaWNhdGlvbnMuaW5zZXJ0XCIpO1xuICAgICAgICB9LFxuICAgICAgICB1cGRhdGVFeHBpcmF0aW9uVGltZTogYXN5bmMgKGVtYWlsOiBzdHJpbmcsIG5ld0V4cGlyYXRpb25UaW1lOiBudW1iZXIsXG4gICAgICAgICAgICByZXM/OiBSZXNwb25zZSk6IFByb21pc2U8dm9pZD4gPT5cbiAgICAgICAge1xuICAgICAgICAgICAgYXdhaXQgREIubWFrZVF1ZXJ5PGFueT4oXG4gICAgICAgICAgICAgICAgXCJVUERBVEUgZW1haWxWZXJpZmljYXRpb25zIFNFVCBleHBpcmF0aW9uVGltZSA9ID8gV0hFUkUgZW1haWwgPSA/O1wiLFxuICAgICAgICAgICAgICAgIFtuZXdFeHBpcmF0aW9uVGltZS50b1N0cmluZygpLCBlbWFpbF1cbiAgICAgICAgICAgICkucnVuKHJlcywgXCJFbWFpbERCLnZlcmlmaWNhdGlvbnMudXBkYXRlRXhwaXJhdGlvblRpbWVcIik7XG4gICAgICAgIH0sXG4gICAgICAgIGRlbGV0ZUV4cGlyZWQ6IGFzeW5jIChjdXJyVGltZTogbnVtYmVyLCByZXM/OiBSZXNwb25zZSk6IFByb21pc2U8dm9pZD4gPT5cbiAgICAgICAge1xuICAgICAgICAgICAgYXdhaXQgREIubWFrZVF1ZXJ5PGFueT4oXG4gICAgICAgICAgICAgICAgXCJERUxFVEUgRlJPTSBlbWFpbFZlcmlmaWNhdGlvbnMgV0hFUkUgZXhwaXJhdGlvblRpbWUgPCA/O1wiLFxuICAgICAgICAgICAgICAgIFtjdXJyVGltZS50b1N0cmluZygpXVxuICAgICAgICAgICAgKS5ydW4ocmVzLCBcIkVtYWlsREIudmVyaWZpY2F0aW9ucy5kZWxldGVFeHBpcmVkXCIpO1xuICAgICAgICB9LFxuICAgIH0sXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVtYWlsREI7IiwiaW1wb3J0IERCIGZyb20gXCIuL2RiXCI7XG5pbXBvcnQgVXNlciBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzL2RiL3VzZXJcIjtcbmltcG9ydCBSb29tIGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXMvZGIvcm9vbVwiO1xuaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IHNlYXJjaFJvb21zQXNzb2NpYXRlZFdpdGhVc2VyID0gKHVzZXJTdGF0dXNlc1RvSW5jbHVkZTogc3RyaW5nW10sIHBhZ2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGxpbWl0ID0gMTA7XG4gICAgY29uc3QgY29uZHNTdHIgPSBgIEFORCAoJHt1c2VyU3RhdHVzZXNUb0luY2x1ZGUubWFwKHggPT4gYHJvb21NZW1iZXJzaGlwcy51c2VyU3RhdHVzID0gJyR7eH0nYCkuam9pbihcIiBPUiBcIil9KWA7XG4gICAgcmV0dXJuIGBTRUxFQ1Qgcm9vbXMucm9vbUlEIEFTIHJvb21JRCwgcm9vbXMucm9vbU5hbWUgQVMgcm9vbU5hbWUsIHJvb21NZW1iZXJzaGlwcy51c2VyU3RhdHVzIGFzIHVzZXJTdGF0dXMsIHJvb21zLm93bmVyVXNlck5hbWUgYXMgb3duZXJVc2VyTmFtZVxuICAgIEZST00gcm9vbXMgSU5ORVIgSk9JTiByb29tTWVtYmVyc2hpcHMgT04gcm9vbU1lbWJlcnNoaXBzLnJvb21JRCA9IHJvb21zLnJvb21JRFxuICAgIFdIRVJFIHJvb21NZW1iZXJzaGlwcy51c2VySUQgPSA/JHt1c2VyU3RhdHVzZXNUb0luY2x1ZGUubGVuZ3RoID4gMCA/IGNvbmRzU3RyIDogXCJcIn1cbiAgICBPUkRFUiBCWSByb29tcy5yb29tSUQgREVTQyBMSU1JVCAke2xpbWl0fSwgJHtwYWdlICogbGltaXR9O2A7XG59XG5cbmNvbnN0IHNlYXJjaFVzZXJzQXNzb2NpYXRlZFdpdGhSb29tID0gKHVzZXJTdGF0dXNlc1RvSW5jbHVkZTogc3RyaW5nW10sIHBhZ2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGxpbWl0ID0gMTA7XG4gICAgY29uc3QgY29uZHNTdHIgPSBgIEFORCAoJHt1c2VyU3RhdHVzZXNUb0luY2x1ZGUubWFwKHggPT4gYHJvb21NZW1iZXJzaGlwcy51c2VyU3RhdHVzID0gJyR7eH0nYCkuam9pbihcIiBPUiBcIil9KWA7XG4gICAgcmV0dXJuIGBTRUxFQ1QgdXNlcnMudXNlcklEIGFzIHVzZXJJRCwgdXNlcnMudXNlck5hbWUgQVMgdXNlck5hbWUsIHJvb21NZW1iZXJzaGlwcy51c2VyU3RhdHVzIGFzIHVzZXJTdGF0dXNcbiAgICBGUk9NIHVzZXJzIElOTkVSIEpPSU4gcm9vbU1lbWJlcnNoaXBzIE9OIHJvb21NZW1iZXJzaGlwcy51c2VySUQgPSB1c2Vycy51c2VySURcbiAgICBXSEVSRSByb29tTWVtYmVyc2hpcHMucm9vbUlEID0gPyR7dXNlclN0YXR1c2VzVG9JbmNsdWRlLmxlbmd0aCA+IDAgPyBjb25kc1N0ciA6IFwiXCJ9XG4gICAgT1JERVIgQlkgdXNlcnMudXNlcklEIERFU0MgTElNSVQgJHtsaW1pdH0sICR7cGFnZSAqIGxpbWl0fTtgO1xufVxuXG5jb25zdCBTZWFyY2hEQiA9XG57XG4gICAgcm9vbXM6IHtcbiAgICAgICAgd2l0aFJvb21OYW1lOiBhc3luYyAocm9vbU5hbWU6IHN0cmluZywgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFJvb21bXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxSb29tPihgU0VMRUNUICogRlJPTSByb29tcyBXSEVSRSByb29tTmFtZSA9ID87YCwgW3Jvb21OYW1lXSlcbiAgICAgICAgICAgICAgICAucnVuKHJlcywgXCJTZWFyY2hEQi5yb29tcy53aXRoUm9vbU5hbWVcIik7XG4gICAgICAgIH0sXG4gICAgICAgIHdoaWNoSU93bjogYXN5bmMgKHVzZXJJRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxSb29tW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8Um9vbT4oc2VhcmNoUm9vbXNBc3NvY2lhdGVkV2l0aFVzZXIoW1wib3duZXJcIl0sIHBhZ2UpLCBbdXNlcklEXSlcbiAgICAgICAgICAgICAgICAucnVuKHJlcywgXCJTZWFyY2hEQi5yb29tcy53aGljaElPd25cIik7XG4gICAgICAgIH0sXG4gICAgICAgIHdoaWNoSUpvaW5lZDogYXN5bmMgKHVzZXJJRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxSb29tW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8Um9vbT4oc2VhcmNoUm9vbXNBc3NvY2lhdGVkV2l0aFVzZXIoW1wibWVtYmVyXCJdLCBwYWdlKSwgW3VzZXJJRF0pXG4gICAgICAgICAgICAgICAgLnJ1bihyZXMsIFwiU2VhcmNoREIucm9vbXMud2hpY2hJSm9pbmVkXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aGljaEludml0ZWRNZTogYXN5bmMgKHVzZXJJRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxSb29tW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8Um9vbT4oc2VhcmNoUm9vbXNBc3NvY2lhdGVkV2l0aFVzZXIoW1wiaW52aXRlZFwiXSwgcGFnZSksIFt1c2VySURdKVxuICAgICAgICAgICAgICAgIC5ydW4ocmVzLCBcIlNlYXJjaERCLnJvb21zLndoaWNoSW52aXRlZE1lXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aGljaElSZXF1ZXN0ZWRUb0pvaW46IGFzeW5jICh1c2VySUQ6IHN0cmluZywgcGFnZTogbnVtYmVyLCByZXM/OiBSZXNwb25zZSk6IFByb21pc2U8Um9vbVtdPiA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgREIubWFrZVF1ZXJ5PFJvb20+KHNlYXJjaFJvb21zQXNzb2NpYXRlZFdpdGhVc2VyKFtcInJlcXVlc3RlZFwiXSwgcGFnZSksIFt1c2VySURdKVxuICAgICAgICAgICAgICAgIC5ydW4ocmVzLCBcIlNlYXJjaERCLnJvb21zLndoaWNoSVJlcXVlc3RlZFRvSm9pblwiKTtcbiAgICAgICAgfSxcbiAgICAgICAgd2hpY2hJQW1QZW5kaW5nVG9Kb2luOiBhc3luYyAodXNlcklEOiBzdHJpbmcsIHBhZ2U6IG51bWJlciwgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFJvb21bXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxSb29tPihzZWFyY2hSb29tc0Fzc29jaWF0ZWRXaXRoVXNlcihbXCJpbnZpdGVkXCIsIFwicmVxdWVzdGVkXCJdLCBwYWdlKSwgW3VzZXJJRF0pXG4gICAgICAgICAgICAgICAgLnJ1bihyZXMsIFwiU2VhcmNoREIucm9vbXMud2hpY2hJQW1QZW5kaW5nVG9Kb2luXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aGljaElBbUFzc29jaWF0ZWRXaXRoOiBhc3luYyAodXNlcklEOiBzdHJpbmcsIHBhZ2U6IG51bWJlciwgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFJvb21bXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxSb29tPihzZWFyY2hSb29tc0Fzc29jaWF0ZWRXaXRoVXNlcihbXSwgcGFnZSksIFt1c2VySURdKVxuICAgICAgICAgICAgICAgIC5ydW4ocmVzLCBcIlNlYXJjaERCLnJvb21zLndoaWNoSUFtQXNzb2NpYXRlZFdpdGhcIik7XG4gICAgICAgIH0sXG4gICAgICAgIG90aGVyczogYXN5bmMgKHVzZXJJRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxSb29tW10+ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbWl0ID0gMTA7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgREIubWFrZVF1ZXJ5PFJvb20+KFxuICAgICAgICAgICAgICAgIGBTRUxFQ1Qgcm9vbUlELCByb29tTmFtZSBGUk9NIHJvb21zXG4gICAgICAgICAgICAgICAgV0hFUkUgTk9UIEVYSVNUUyAoU0VMRUNUIHJvb21JRCBGUk9NIHJvb21NZW1iZXJzaGlwcyBXSEVSRSB1c2VySUQgPSAke3VzZXJJRH0gTElNSVQgMSlcbiAgICAgICAgICAgICAgICBPUkRFUiBCWSByb29tSUQgREVTQyBMSU1JVCAke2xpbWl0fSwgJHtwYWdlICogbGltaXR9O2AsXG4gICAgICAgICAgICAgICAgdW5kZWZpbmVkXG4gICAgICAgICAgICApLnJ1bihyZXMsIFwiU2VhcmNoREIucm9vbXMub3RoZXJzXCIpO1xuICAgICAgICB9LFxuICAgIH0sXG4gICAgdXNlcnM6IHtcbiAgICAgICAgd2l0aFVzZXJOYW1lOiBhc3luYyAodXNlck5hbWU6IHN0cmluZywgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFVzZXJbXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxVc2VyPihgU0VMRUNUICogRlJPTSB1c2VycyBXSEVSRSB1c2VyTmFtZSA9ID87YCwgW3VzZXJOYW1lXSlcbiAgICAgICAgICAgICAgICAucnVuKHJlcywgXCJTZWFyY2hEQi51c2Vycy53aXRoVXNlck5hbWVcIik7XG4gICAgICAgIH0sXG4gICAgICAgIHdpdGhFbWFpbDogYXN5bmMgKGVtYWlsOiBzdHJpbmcsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxVc2VyW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8VXNlcj4oYFNFTEVDVCAqIEZST00gdXNlcnMgV0hFUkUgZW1haWwgPSA/O2AsIFtlbWFpbF0pXG4gICAgICAgICAgICAgICAgLnJ1bihyZXMsIFwiU2VhcmNoREIudXNlcnMud2l0aEVtYWlsXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aG9Kb2luZWRSb29tOiBhc3luYyAocm9vbUlEOiBzdHJpbmcsIHBhZ2U6IG51bWJlciwgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFVzZXJbXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxVc2VyPihzZWFyY2hVc2Vyc0Fzc29jaWF0ZWRXaXRoUm9vbShbXCJtZW1iZXJcIl0sIHBhZ2UpLCBbcm9vbUlEXSlcbiAgICAgICAgICAgICAgICAucnVuKHJlcywgXCJTZWFyY2hEQi51c2Vycy53aG9Kb2luZWRSb29tXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aG9BcmVJbnZpdGVkVG9Kb2luUm9vbTogYXN5bmMgKHJvb21JRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxVc2VyW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8VXNlcj4oc2VhcmNoVXNlcnNBc3NvY2lhdGVkV2l0aFJvb20oW1wiaW52aXRlZFwiXSwgcGFnZSksIFtyb29tSURdKVxuICAgICAgICAgICAgICAgIC5ydW4ocmVzLCBcIlNlYXJjaERCLnVzZXJzLndob0FyZUludml0ZWRUb0pvaW5Sb29tXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aG9SZXF1ZXN0ZWRUb0pvaW5Sb29tOiBhc3luYyAocm9vbUlEOiBzdHJpbmcsIHBhZ2U6IG51bWJlciwgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPFVzZXJbXT4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxVc2VyPihzZWFyY2hVc2Vyc0Fzc29jaWF0ZWRXaXRoUm9vbShbXCJyZXF1ZXN0ZWRcIl0sIHBhZ2UpLCBbcm9vbUlEXSlcbiAgICAgICAgICAgICAgICAucnVuKHJlcywgXCJTZWFyY2hEQi51c2Vycy53aG9SZXF1ZXN0ZWRUb0pvaW5Sb29tXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aG9BcmVQZW5kaW5nVG9Kb2luUm9vbTogYXN5bmMgKHJvb21JRDogc3RyaW5nLCBwYWdlOiBudW1iZXIsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxVc2VyW10+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBEQi5tYWtlUXVlcnk8VXNlcj4oc2VhcmNoVXNlcnNBc3NvY2lhdGVkV2l0aFJvb20oW1wiaW52aXRlZFwiLCBcInJlcXVlc3RlZFwiXSwgcGFnZSksIFtyb29tSURdKVxuICAgICAgICAgICAgICAgIC5ydW4ocmVzLCBcIlNlYXJjaERCLnVzZXJzLndob0FyZVBlbmRpbmdUb0pvaW5Sb29tXCIpO1xuICAgICAgICB9LFxuICAgICAgICB3aG9BcmVBc3NvY2lhdGVkV2l0aFJvb206IGFzeW5jIChyb29tSUQ6IHN0cmluZywgcGFnZTogbnVtYmVyLCByZXM/OiBSZXNwb25zZSk6IFByb21pc2U8VXNlcltdPiA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgREIubWFrZVF1ZXJ5PFVzZXI+KHNlYXJjaFVzZXJzQXNzb2NpYXRlZFdpdGhSb29tKFtdLCBwYWdlKSwgW3Jvb21JRF0pXG4gICAgICAgICAgICAgICAgLnJ1bihyZXMsIFwiU2VhcmNoREIudXNlcnMud2hvQXJlQXNzb2NpYXRlZFdpdGhSb29tXCIpO1xuICAgICAgICB9LFxuICAgICAgICBvdGhlcnM6IGFzeW5jIChyb29tSUQ6IHN0cmluZywgcGFnZTogbnVtYmVyLCByZXM/OiBSZXNwb25zZSk6IFByb21pc2U8VXNlcltdPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW1pdCA9IDEwO1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IERCLm1ha2VRdWVyeTxVc2VyPihcbiAgICAgICAgICAgICAgICBgU0VMRUNUIHVzZXJJRCwgdXNlck5hbWUgRlJPTSB1c2Vyc1xuICAgICAgICAgICAgICAgIFdIRVJFIE5PVCBFWElTVFMgKFNFTEVDVCB1c2VySUQgRlJPTSByb29tTWVtYmVyc2hpcHMgV0hFUkUgcm9vbUlEID0gJHtyb29tSUR9IExJTUlUIDEpXG4gICAgICAgICAgICAgICAgT1JERVIgQlkgdXNlcklEIERFU0MgTElNSVQgJHtsaW1pdH0sICR7cGFnZSAqIGxpbWl0fTtgLFxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgICAgICAgKS5ydW4ocmVzLCBcIlNlYXJjaERCLnVzZXJzLm90aGVyc1wiKTtcbiAgICAgICAgfSxcbiAgICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBTZWFyY2hEQjsiLCJpbXBvcnQgbXlzcWwgZnJvbSBcIm15c3FsMi9wcm9taXNlXCI7XG5pbXBvcnQgeyBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgRGVidWdVdGlsIGZyb20gXCIuLi8uLi91dGlsL2RlYnVnVXRpbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeTxSZXR1cm5UeXBlPlxue1xuICAgIHB1YmxpYyBxdWVyeVN0cjogc3RyaW5nO1xuICAgIHB1YmxpYyBxdWVyeVBhcmFtcz86IHN0cmluZ1tdO1xuXG4gICAgcHJpdmF0ZSBwb29sOiBteXNxbC5Qb29sO1xuXG4gICAgY29uc3RydWN0b3IocG9vbDogbXlzcWwuUG9vbCwgcXVlcnlTdHI6IHN0cmluZywgcXVlcnlQYXJhbXM/OiBzdHJpbmdbXSlcbiAgICB7XG4gICAgICAgIHRoaXMucG9vbCA9IHBvb2w7XG4gICAgICAgIHRoaXMucXVlcnlTdHIgPSBxdWVyeVN0cjtcbiAgICAgICAgdGhpcy5xdWVyeVBhcmFtcyA9IHF1ZXJ5UGFyYW1zO1xuICAgIH1cblxuICAgIGFzeW5jIHJ1bihyZXM/OiBSZXNwb25zZSwgc3RhY2tUcmFjZU5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPFJldHVyblR5cGVbXT5cbiAgICB7XG4gICAgICAgIGlmIChzdGFja1RyYWNlTmFtZSlcbiAgICAgICAgICAgIERlYnVnVXRpbC5wdXNoU3RhY2tUcmFjZShzdGFja1RyYWNlTmFtZSk7XG4gICAgICAgIERlYnVnVXRpbC5sb2coXCJTUUwgUXVlcnkgU3RhcnRlZFwiLCB7cXVlcnlTdHI6IHRoaXMucXVlcnlTdHIsIHF1ZXJ5UGFyYW1zOiB0aGlzLnF1ZXJ5UGFyYW1zfSwgXCJsb3dcIik7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IFtyZXN1bHQsIGZpZWxkc10gPSBhd2FpdCB0aGlzLnBvb2wucXVlcnk8bXlzcWwuUm93RGF0YVBhY2tldFtdPih0aGlzLnF1ZXJ5U3RyLCB0aGlzLnF1ZXJ5UGFyYW1zKTtcbiAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJTUUwgUXVlcnkgU3VjY2VlZGVkXCIsIHtxdWVyeVN0cjogdGhpcy5xdWVyeVN0ciwgcXVlcnlQYXJhbXM6IHRoaXMucXVlcnlQYXJhbXN9LCBcIm1lZGl1bVwiKTtcbiAgICAgICAgICAgIGlmIChzdGFja1RyYWNlTmFtZSlcbiAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwucG9wU3RhY2tUcmFjZShzdGFja1RyYWNlTmFtZSk7XG4gICAgICAgICAgICByZXM/LnN0YXR1cygyMDIpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCBhcyBSZXR1cm5UeXBlW107XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBRdWVyeSBFcnJvclwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIGlmIChzdGFja1RyYWNlTmFtZSlcbiAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwucG9wU3RhY2tUcmFjZShzdGFja1RyYWNlTmFtZSk7XG4gICAgICAgICAgICByZXM/LnN0YXR1cyg1MDApLnNlbmQoZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cbn0iLCJpbXBvcnQgbXlzcWwgZnJvbSBcIm15c3FsMi9wcm9taXNlXCI7XG5pbXBvcnQgeyBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgUXVlcnkgZnJvbSBcIi4vcXVlcnlcIjtcbmltcG9ydCBEZWJ1Z1V0aWwgZnJvbSBcIi4uLy4uL3V0aWwvZGVidWdVdGlsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRyYW5zYWN0aW9uXG57XG4gICAgcHVibGljIHF1ZXJpZXM6IFF1ZXJ5PHZvaWQ+W107XG5cbiAgICBwcml2YXRlIHBvb2w6IG15c3FsLlBvb2w7XG5cbiAgICBjb25zdHJ1Y3Rvcihwb29sOiBteXNxbC5Qb29sLCBxdWVyaWVzOiBRdWVyeTx2b2lkPltdKVxuICAgIHtcbiAgICAgICAgdGhpcy5wb29sID0gcG9vbDtcbiAgICAgICAgdGhpcy5xdWVyaWVzID0gcXVlcmllcztcbiAgICB9XG5cbiAgICBhc3luYyBydW4ocmVzPzogUmVzcG9uc2UsIHN0YWNrVHJhY2VOYW1lPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPlxuICAgIHtcbiAgICAgICAgaWYgKHN0YWNrVHJhY2VOYW1lKVxuICAgICAgICAgICAgRGVidWdVdGlsLnB1c2hTdGFja1RyYWNlKHN0YWNrVHJhY2VOYW1lKTtcbiAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBUcmFuc2FjdGlvbiBCZWdhblwiLCB7bnVtUXVlcmllczogdGhpcy5xdWVyaWVzLmxlbmd0aH0sIFwibG93XCIpO1xuXG4gICAgICAgIGxldCBjb25uOiBteXNxbC5Qb29sQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IHN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbm4gPSBhd2FpdCB0aGlzLnBvb2wuZ2V0Q29ubmVjdGlvbigpO1xuICAgICAgICAgICAgYXdhaXQgY29ubi5iZWdpblRyYW5zYWN0aW9uKCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcXVlcnkgb2YgdGhpcy5xdWVyaWVzKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBUcmFuc2FjdGlvbiBRdWVyeSBTdGFydGVkXCIsIHtwcm9ncmVzczogYCR7Y291bnR9LyR7dGhpcy5xdWVyaWVzLmxlbmd0aH1gLCBxdWVyeX0sIFwibG93XCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IFtyZXN1bHQsIGZpZWxkc10gPSBhd2FpdCBjb25uPy5xdWVyeTxteXNxbC5SZXN1bHRTZXRIZWFkZXI+KHF1ZXJ5LnF1ZXJ5U3RyLCBxdWVyeS5xdWVyeVBhcmFtcyk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5hZmZlY3RlZFJvd3MgPT0gMClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGNvbm4/LnJvbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJTUUwgVHJhbnNhY3Rpb24gUXVlcnkgTWFkZSBObyBDaGFuZ2VcIiwge3Byb2dyZXNzOiBgJHtjb3VudH0vJHt0aGlzLnF1ZXJpZXMubGVuZ3RofWAsIHF1ZXJ5fSwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhY2tUcmFjZU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwucG9wU3RhY2tUcmFjZShzdGFja1RyYWNlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlcz8uc3RhdHVzKDQwMyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBUcmFuc2FjdGlvbiBRdWVyeSBTdWNjZWVkZWRcIiwge3Byb2dyZXNzOiBgJHtjb3VudH0vJHt0aGlzLnF1ZXJpZXMubGVuZ3RofWAsIHF1ZXJ5fSwgXCJsb3dcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IGNvbm4/LmNvbW1pdCgpO1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZ1JhdyhcIlNRTCBUcmFuc2FjdGlvbiBDb21taXR0ZWRcIiwgXCJtZWRpdW1cIik7XG4gICAgICAgICAgICBpZiAoc3RhY2tUcmFjZU5hbWUpXG4gICAgICAgICAgICAgICAgRGVidWdVdGlsLnBvcFN0YWNrVHJhY2Uoc3RhY2tUcmFjZU5hbWUpO1xuICAgICAgICAgICAgc3VjY2VzcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIlNRTCBUcmFuc2FjdGlvbiBFcnJvclwiLCB7cHJvZ3Jlc3M6IGAke2NvdW50fS8ke3RoaXMucXVlcmllcy5sZW5ndGh9YCwgZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIGF3YWl0IGNvbm4/LnJvbGxiYWNrKCk7XG4gICAgICAgICAgICBpZiAoc3RhY2tUcmFjZU5hbWUpXG4gICAgICAgICAgICAgICAgRGVidWdVdGlsLnBvcFN0YWNrVHJhY2Uoc3RhY2tUcmFjZU5hbWUpO1xuICAgICAgICAgICAgcmVzPy5zdGF0dXMoNTAwKS5zZW5kKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgZmluYWxseSB7XG4gICAgICAgICAgICBjb25uPy5yZWxlYXNlKCk7XG4gICAgICAgICAgICBpZiAoc3VjY2VzcylcbiAgICAgICAgICAgICAgICByZXM/LnN0YXR1cygyMDIpO1xuICAgICAgICB9XG4gICAgfTtcbn0iLCJpbXBvcnQgQXV0aFV0aWwgZnJvbSBcIi4uLy4uL3V0aWwvYXV0aFV0aWxcIjtcbi8vaW1wb3J0IEVtYWlsVXRpbCBmcm9tIFwiLi4vLi4vdXRpbC9lbWFpbFV0aWxcIjtcbmltcG9ydCBOZXR3b3JrVXRpbCBmcm9tIFwiLi4vLi4vdXRpbC9uZXR3b3JrVXRpbFwiO1xuaW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3QgQXV0aFJvdXRlciA9IGV4cHJlc3MuUm91dGVyKCk7XG4vKlxuLy8gcmVxLmJvZHkgPSB7dXNlck5hbWUsIHBhc3N3b3JkLCBlbWFpbCwgdmVyaWZpY2F0aW9uQ29kZX1cbkF1dGhSb3V0ZXIucG9zdChcIi9yZWdpc3RlclwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgYXdhaXQgQXV0aFV0aWwucmVnaXN0ZXIocmVxLCByZXMpO1xuICAgIE5ldHdvcmtVdGlsLm9uUm91dGVSZXNwb25zZShyZXMpO1xufSk7XG5cbi8vIHJlcS5ib2R5ID0ge2VtYWlsfVxuQXV0aFJvdXRlci5wb3N0KFwiL3ZlbWFpbFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgYXdhaXQgRW1haWxVdGlsLnN0YXJ0RW1haWxWZXJpZmljYXRpb24ocmVxLCByZXMpO1xuICAgIE5ldHdvcmtVdGlsLm9uUm91dGVSZXNwb25zZShyZXMpO1xufSk7XG5cbi8vIHJlcS5ib2R5ID0ge3VzZXJOYW1lLCBwYXNzd29yZH1cbkF1dGhSb3V0ZXIucG9zdChcIi9sb2dpblwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgYXdhaXQgQXV0aFV0aWwubG9naW4ocmVxLCByZXMpO1xuICAgIE5ldHdvcmtVdGlsLm9uUm91dGVSZXNwb25zZShyZXMpO1xufSk7XG4qL1xuQXV0aFJvdXRlci5nZXQoXCIvY2xlYXItdG9rZW5cIiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgIEF1dGhVdGlsLmNsZWFyVG9rZW4ocmVxLCByZXMpO1xuICAgIE5ldHdvcmtVdGlsLm9uUm91dGVSZXNwb25zZShyZXMpO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IEF1dGhSb3V0ZXI7IiwiaW1wb3J0IHsgRXhwcmVzcywgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IFBhZ2VSb3V0ZXIgZnJvbSBcIi4vdWkvcGFnZVJvdXRlclwiO1xuaW1wb3J0IEF1dGhSb3V0ZXIgZnJvbSBcIi4vYXBpL2F1dGhSb3V0ZXJcIjtcbi8vaW1wb3J0IFJvb21Sb3V0ZXIgZnJvbSBcIi4vYXBpL3Jvb21Sb3V0ZXJcIjtcbi8vaW1wb3J0IEFkbWluUm91dGVyIGZyb20gXCIuL2FwaS9hZG1pblJvdXRlclwiO1xuLy9pbXBvcnQgU2VhcmNoUm91dGVyIGZyb20gXCIuL2FwaS9zZWFyY2hSb3V0ZXJcIjtcbmltcG9ydCBGaWxlVXRpbCBmcm9tIFwiLi4vdXRpbC9maWxlVXRpbFwiO1xuaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uL3V0aWwvZWpzVXRpbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBSb3V0ZXIoYXBwOiBFeHByZXNzKTogdm9pZFxue1xuICAgIC8vIElmIHlvdSBhcmUgaW4gZGV2IG1vZGUsIGFsc28gZW11bGF0ZSB0aGUgYmVoYXZpb3Igb2YgdGhlIHN0YXRpYyB3ZWIgc2VydmVyLlxuICAgIGlmIChwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCIpXG4gICAge1xuICAgICAgICBhcHAuZ2V0KFwiL1wiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdGF0aWNDb250ZW50ID0gYXdhaXQgRmlsZVV0aWwucmVhZChyZXEudXJsICsgXCJpbmRleC5odG1sXCIpO1xuICAgICAgICAgICAgcmVzLnN0YXR1cygyMDApLnNldEhlYWRlcihcImNvbnRlbnQtdHlwZVwiLCBcInRleHQvaHRtbFwiKVxuICAgICAgICAgICAgICAgIC5zZW5kKEVKU1V0aWwucG9zdFByb2Nlc3NIVE1MKHN0YXRpY0NvbnRlbnQpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGFwcC5nZXQoLy4qXFwuaHRtbCQvLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdGF0aWNDb250ZW50ID0gYXdhaXQgRmlsZVV0aWwucmVhZChyZXEudXJsKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS5zZXRIZWFkZXIoXCJjb250ZW50LXR5cGVcIiwgXCJ0ZXh0L2h0bWxcIilcbiAgICAgICAgICAgICAgICAuc2VuZChFSlNVdGlsLnBvc3RQcm9jZXNzSFRNTChzdGF0aWNDb250ZW50KSk7XG4gICAgICAgIH0pO1xuICAgICAgICBhcHAuZ2V0KC8uKlxcLmpzJC8sIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS5zZXRIZWFkZXIoXCJjb250ZW50LXR5cGVcIiwgXCJ0ZXh0L2phdmFzY3JpcHRcIilcbiAgICAgICAgICAgICAgICAuc2VuZEZpbGUoRmlsZVV0aWwuZ2V0QWJzb2x1dGVGaWxlUGF0aChyZXEudXJsKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBhcHAuZ2V0KC8oLipcXC5jc3MpfCguKlxcLmpwZyl8KC4qXFwucG5nKXwoLipcXC5pY28pfCguKlxcLmF0b20pfCguKlxcLnhtbCl8KC4qXFwucGRmKSQvLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICByZXMuc2VuZEZpbGUoRmlsZVV0aWwuZ2V0QWJzb2x1dGVGaWxlUGF0aChyZXEudXJsKSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICBhcHAudXNlKFwiL2FwaS9hdXRoXCIsIEF1dGhSb3V0ZXIpO1xuICAgIC8vYXBwLnVzZShcIi9hcGkvc2VhcmNoXCIsIFNlYXJjaFJvdXRlcik7XG4gICAgLy9hcHAudXNlKFwiL2FwaS9yb29tXCIsIFJvb21Sb3V0ZXIpO1xuICAgIC8vYXBwLnVzZShcIi9hcGkvYWRtaW5cIiwgQWRtaW5Sb3V0ZXIpO1xuICAgIGFwcC51c2UoXCIvXCIsIFBhZ2VSb3V0ZXIpO1xufSIsImltcG9ydCBBdXRoVXRpbCBmcm9tIFwiLi4vLi4vdXRpbC9hdXRoVXRpbFwiO1xuaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uLy4uL3V0aWwvZWpzVXRpbFwiO1xuaW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHsgQXJjYWRlRGF0YSB9IGZyb20gXCIuLi8uLi9zc2cvZGF0YS9hcmNhZGVEYXRhXCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IFBhZ2VSb3V0ZXIgPSBleHByZXNzLlJvdXRlcigpO1xuXG5QYWdlUm91dGVyLmdldChcIi9teXBhZ2VcIiwgQXV0aFV0aWwuYXV0aGVudGljYXRlQW55VXNlciwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgIEVKU1V0aWwucmVuZGVyKHJlcSwgcmVzLCBcInBhZ2UvZHluYW1pYy9teXBhZ2VcIiwge1xuICAgICAgICBsb2dpbkRlc3RpbmF0aW9uOiBgJHtwcm9jZXNzLmVudi5VUkxfRFlOQU1JQ30vbXlwYWdlYCxcbiAgICB9KTtcbn0pO1xuXG5QYWdlUm91dGVyLmdldChcIi9yZWdpc3RlclwiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogdm9pZCA9PiB7XG4gICAgRUpTVXRpbC5yZW5kZXIocmVxLCByZXMsIFwicGFnZS9keW5hbWljL3JlZ2lzdGVyXCIsIHtcbiAgICAgICAgcmVnaXN0ZXJEZXN0aW5hdGlvbjogYCR7cHJvY2Vzcy5lbnYuVVJMX0RZTkFNSUN9L215cGFnZWAsXG4gICAgfSk7XG59KTtcblxuUGFnZVJvdXRlci5nZXQoXCIvbG9naW5cIiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgIEVKU1V0aWwucmVuZGVyKHJlcSwgcmVzLCBcInBhZ2UvZHluYW1pYy9sb2dpblwiLCB7XG4gICAgICAgIGxvZ2luRGVzdGluYXRpb246IGAke3Byb2Nlc3MuZW52LlVSTF9EWU5BTUlDfS9teXBhZ2VgLFxuICAgIH0pO1xufSk7XG5cbmlmIChwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCIpXG57XG4gICAgUGFnZVJvdXRlci5nZXQoXCIvYWRtaW5cIiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgICAgICBFSlNVdGlsLnJlbmRlcihyZXEsIHJlcywgXCJwYWdlL2RldmVsb3BtZW50L2FkbWluXCIsIHt9KTtcbiAgICB9KTtcblxuICAgIFBhZ2VSb3V0ZXIuZ2V0KFwiL2NvbnNvbGVcIiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgICAgICBFSlNVdGlsLnJlbmRlcihyZXEsIHJlcywgXCJwYWdlL2RldmVsb3BtZW50L2NvbnNvbGVcIiwge30pO1xuICAgIH0pO1xuXG4gICAgUGFnZVJvdXRlci5nZXQoXCIvdGVzdC11aVwiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKTogdm9pZCA9PiB7XG4gICAgICAgIEVKU1V0aWwucmVuZGVyKHJlcSwgcmVzLCBcInBhZ2UvZGV2ZWxvcG1lbnQvdGVzdF91aVwiLCB7XG4gICAgICAgICAgICBnYW1lRW50cmllczogQXJjYWRlRGF0YS5nYW1lRW50cmllc1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cbmVsc2VcbntcbiAgICBQYWdlUm91dGVyLmdldChcIi9hZG1pblwiLCBBdXRoVXRpbC5hdXRoZW50aWNhdGVBZG1pbiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IHZvaWQgPT4ge1xuICAgICAgICBFSlNVdGlsLnJlbmRlcihyZXEsIHJlcywgXCJwYWdlL2RldmVsb3BtZW50L2FkbWluXCIsIHt9KTtcbiAgICB9KTtcblxuICAgIFBhZ2VSb3V0ZXIuZ2V0KFwiL2NvbnNvbGVcIiwgQXV0aFV0aWwuYXV0aGVudGljYXRlQWRtaW4sIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpOiB2b2lkID0+IHtcbiAgICAgICAgRUpTVXRpbC5yZW5kZXIocmVxLCByZXMsIFwicGFnZS9kZXZlbG9wbWVudC9jb25zb2xlXCIsIHt9KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFnZVJvdXRlcjsiLCJpbXBvcnQgc29ja2V0SU8gZnJvbSBcInNvY2tldC5pb1wiO1xuaW1wb3J0IHsgU29ja2V0TWlkZGxld2FyZSB9IGZyb20gXCIuL3R5cGVzL3NvY2tldE1pZGRsZXdhcmVcIjtcbmltcG9ydCBEZWJ1Z1V0aWwgZnJvbSBcIi4uL3V0aWwvZGVidWdVdGlsXCI7XG5pbXBvcnQgREIgZnJvbSBcIi4uL2RiL2RiXCI7XG5cbmxldCBuc3A6IHNvY2tldElPLk5hbWVzcGFjZTtcblxuY29uc3QgY29sMSA9IGA8dGQgc3R5bGU9XCJjb2xvcjogI2UwZTAyMDsgYmFja2dyb3VuZC1jb2xvcjogIzIwMjA5MDtcIj5gO1xuY29uc3QgY29sMiA9IGA8dGQgc3R5bGU9XCJjb2xvcjogIzIwZTAyMDsgYmFja2dyb3VuZC1jb2xvcjogIzEwMTAxMDtcIj5gO1xuY29uc3QgY29sMyA9IGA8dGQgc3R5bGU9XCJjb2xvcjogIzMwMzAzMDsgYmFja2dyb3VuZC1jb2xvcjogI2MwYzBjMDtcIj5gO1xuY29uc3QgZW5kID0gYDwvdGQ+YDtcbmNvbnN0IHJvdyA9ICh0eHQxOiBzdHJpbmcsIHR4dDI6IHN0cmluZywgdHh0Mzogc3RyaW5nKSA9PlxuICAgIGAke2NvbDF9JHt0eHQxfSR7ZW5kfSR7Y29sMn0ke3R4dDJ9JHtlbmR9JHtjb2wzfSR7dHh0M30ke2VuZH1gO1xuXG5jb25zdCBDb25zb2xlU29ja2V0cyA9XG57XG4gICAgaW5pdDogKGlvOiBzb2NrZXRJTy5TZXJ2ZXIsIGF1dGhNaWRkbGV3YXJlOiBTb2NrZXRNaWRkbGV3YXJlKTogdm9pZCA9PlxuICAgIHtcbiAgICAgICAgbnNwID0gaW8ub2YoXCIvY29uc29sZV9zb2NrZXRzXCIpO1xuICAgICAgICBuc3AudXNlKGF1dGhNaWRkbGV3YXJlKTtcbiAgICBcbiAgICAgICAgbnNwLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0OiBzb2NrZXRJTy5Tb2NrZXQpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAoQ29uc29sZVNvY2tldHMpIENsaWVudCBjb25uZWN0ZWQgOjogJHtKU09OLnN0cmluZ2lmeShzb2NrZXQuaGFuZHNoYWtlLmF1dGgpfWApO1xuXG4gICAgICAgICAgICBzb2NrZXQub24oXCJjb21tYW5kXCIsIChjb21tYW5kKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYChDb25zb2xlU29ja2V0cykgQ29tbWFuZCByZWNlaXZlZCA6OiBbJHtjb21tYW5kfV0gLSBzZW50IGJ5IDo6ICR7SlNPTi5zdHJpbmdpZnkoc29ja2V0LmhhbmRzaGFrZS5hdXRoLnVzZXIpfWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gY29tbWFuZC5zcGxpdChcIiBcIik7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh3b3Jkc1swXSlcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJwcmludFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgd29yZHMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2dSYXcoKHdvcmRzLmxlbmd0aCA9PSAwKSA/IFwiLVwiIDogd29yZHMuam9pbihcIiBcIiksIFwiaGlnaFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGJcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd29yZHMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEQi5ydW5TUUxGaWxlKGAke3dvcmRzWzBdfS5zcWxgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwubG9nUmF3KGBDb21tYW5kIFwiJHt3b3Jkc1swXX1cIiBpcyBzdXBwb3J0ZWQgb25seSBpbiBkZXYgbW9kZS5gLCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJyZWJvb3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2dSYXcoXCJSZWJvb3RpbmcuLi5cIiwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwubG9nUmF3KGBVbmtub3duIGNvbW1hbmQgXCIke3dvcmRzWzBdfVwiLmAsIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYChDb25zb2xlU29ja2V0cykgQ2xpZW50IGRpc2Nvbm5lY3RlZCA6OiAke0pTT04uc3RyaW5naWZ5KHNvY2tldC5oYW5kc2hha2UuYXV0aCl9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBsb2c6IChtZXNzYWdlOiBzdHJpbmcsIG9yaWdpbjogc3RyaW5nLCBkZXRhaWxzOiBzdHJpbmcpOiB2b2lkID0+XG4gICAge1xuICAgICAgICBpZiAobnNwKVxuICAgICAgICAgICAgbnNwLmVtaXQoXCJsb2dcIiwgcm93KG1lc3NhZ2UsIG9yaWdpbiwgZGV0YWlscykpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHttZXNzYWdlfVxcbihPUklHSU46ICR7b3JpZ2lufSlcXG4oREVUQUlMUzogJHtkZXRhaWxzfSlgKTtcbiAgICB9LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgQ29uc29sZVNvY2tldHM7IiwiaW1wb3J0IHNvY2tldElPIGZyb20gXCJzb2NrZXQuaW9cIjtcbmltcG9ydCB7IFNvY2tldE1pZGRsZXdhcmUgfSBmcm9tIFwiLi90eXBlcy9zb2NrZXRNaWRkbGV3YXJlXCI7XG5pbXBvcnQgTWVzc2FnZVBhcmFtcyBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzL25ldHdvcmtpbmcvbWVzc2FnZVBhcmFtc1wiXG5pbXBvcnQgT2JqZWN0U3luY1BhcmFtcyBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzL25ldHdvcmtpbmcvb2JqZWN0U3luY1BhcmFtc1wiO1xuaW1wb3J0IE9iamVjdFNwYXduUGFyYW1zIGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXMvbmV0d29ya2luZy9vYmplY3RTcGF3blBhcmFtc1wiO1xuaW1wb3J0IE9iamVjdERlc3Bhd25QYXJhbXMgZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlcy9uZXR3b3JraW5nL29iamVjdERlc3Bhd25QYXJhbXNcIjtcbmltcG9ydCBPYmplY3RSZWNvcmQgZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlcy9uZXR3b3JraW5nL29iamVjdFJlY29yZFwiO1xuaW1wb3J0IFVzZXIgZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlcy9kYi91c2VyXCI7XG5pbXBvcnQgT2JqZWN0VHJhbnNmb3JtIGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXMvbmV0d29ya2luZy9vYmplY3RUcmFuc2Zvcm1cIjtcblxubGV0IG5zcDogc29ja2V0SU8uTmFtZXNwYWNlO1xuXG5jb25zdCBvYmplY3RSZWNvcmRzOiB7W29iamVjdElkOiBzdHJpbmddOiBPYmplY3RSZWNvcmR9ID0ge307XG5cbmNvbnN0IEdhbWVTb2NrZXRzID1cbntcbiAgICBpbml0OiAoaW86IHNvY2tldElPLlNlcnZlciwgYXV0aE1pZGRsZXdhcmU6IFNvY2tldE1pZGRsZXdhcmUpOiB2b2lkID0+XG4gICAge1xuICAgICAgICBuc3AgPSBpby5vZihcIi9nYW1lX3NvY2tldHNcIik7XG4gICAgICAgIG5zcC51c2UoYXV0aE1pZGRsZXdhcmUpO1xuXG4gICAgICAgIG5zcC5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldDogc29ja2V0SU8uU29ja2V0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB1c2VyOiBVc2VyID0gc29ja2V0LmhhbmRzaGFrZS5hdXRoIGFzIFVzZXI7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAoR2FtZVNvY2tldHMpIENsaWVudCBjb25uZWN0ZWQgOjogJHtKU09OLnN0cmluZ2lmeSh1c2VyKX1gKTtcblxuICAgICAgICAgICAgc29ja2V0Lm9uKFwibWVzc2FnZVwiLCAocGFyYW1zOiBNZXNzYWdlUGFyYW1zKSA9PiB7XG4gICAgICAgICAgICAgICAgbnNwLnRvKFwicm9vbV9kZWZhdWx0XCIpLmVtaXQoXCJtZXNzYWdlXCIsIHBhcmFtcyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc29ja2V0Lm9uKFwib2JqZWN0U3luY1wiLCAocGFyYW1zOiBPYmplY3RTeW5jUGFyYW1zKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0UmVjb3JkID0gb2JqZWN0UmVjb3Jkc1twYXJhbXMub2JqZWN0SWRdO1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3RSZWNvcmQgPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVHJpZWQgdG8gc3luYyBhIG5vbmV4aXN0ZW50IG9iamVjdCA6OiAke0pTT04uc3RyaW5naWZ5KHBhcmFtcyl9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihvYmplY3RSZWNvcmQudHJhbnNmb3JtLCBwYXJhbXMudHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICBuc3AudG8oXCJyb29tX2RlZmF1bHRcIikuZW1pdChcIm9iamVjdFN5bmNcIiwgcGFyYW1zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzb2NrZXQub24oXCJvYmplY3RTcGF3blwiLCAocGFyYW1zOiBPYmplY3RTcGF3blBhcmFtcykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9iamVjdCA9IG9iamVjdFJlY29yZHNbcGFyYW1zLm9iamVjdElkXTtcbiAgICAgICAgICAgICAgICBpZiAob2JqZWN0ICE9IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFRyaWVkIHRvIHNwYXduIGFuIGFscmVhZHkgZXhpc3Rpbmcgb2JqZWN0IDo6ICR7SlNPTi5zdHJpbmdpZnkocGFyYW1zKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm1Db3B5ID0ge307XG4gICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbih0cmFuc2Zvcm1Db3B5LCBwYXJhbXMudHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgICAgIG9iamVjdFJlY29yZHNbcGFyYW1zLm9iamVjdElkXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0VHlwZTogcGFyYW1zLm9iamVjdFR5cGUsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdElkOiBwYXJhbXMub2JqZWN0SWQsXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNmb3JtQ29weSBhcyBPYmplY3RUcmFuc2Zvcm0sXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIG5zcC50byhcInJvb21fZGVmYXVsdFwiKS5lbWl0KFwib2JqZWN0U3Bhd25cIiwgcGFyYW1zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzb2NrZXQub24oXCJvYmplY3REZXNwYXduXCIsIChwYXJhbXM6IE9iamVjdERlc3Bhd25QYXJhbXMpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmplY3QgPSBvYmplY3RSZWNvcmRzW3BhcmFtcy5vYmplY3RJZF07XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdCA9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUcmllZCB0byBkZXNwYXduIGEgbm9uZXhpc3RlbnQgb2JqZWN0IDo6ICR7SlNPTi5zdHJpbmdpZnkocGFyYW1zKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWxldGUgb2JqZWN0UmVjb3Jkc1twYXJhbXMub2JqZWN0SWRdO1xuXG4gICAgICAgICAgICAgICAgbnNwLnRvKFwicm9vbV9kZWZhdWx0XCIpLmVtaXQoXCJvYmplY3REZXNwYXduXCIsIHBhcmFtcyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYChHYW1lU29ja2V0cykgQ2xpZW50IGRpc2Nvbm5lY3RlZCA6OiAke0pTT04uc3RyaW5naWZ5KHVzZXIpfWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3Bhd25QZW5kaW5nT2JqZWN0SWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgb2JqZWN0UmVjb3JkIG9mIE9iamVjdC52YWx1ZXMob2JqZWN0UmVjb3JkcykpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0UmVjb3JkLm9iamVjdElkLnN0YXJ0c1dpdGgodXNlci51c2VyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBEZXNwYXduZWQgOjogJHtvYmplY3RSZWNvcmQub2JqZWN0SWR9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNwYXduUGVuZGluZ09iamVjdElkcy5wdXNoKG9iamVjdFJlY29yZC5vYmplY3RJZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBvYmplY3RJZCBvZiBkZXNwYXduUGVuZGluZ09iamVjdElkcylcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RSZWNvcmRzW29iamVjdElkXSAhPSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgb2JqZWN0UmVjb3Jkc1tvYmplY3RJZF07XG4gICAgICAgICAgICAgICAgICAgIG5zcC50byhcInJvb21fZGVmYXVsdFwiKS5lbWl0KFwib2JqZWN0RGVzcGF3blwiLCB7IG9iamVjdElkIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzb2NrZXQuam9pbihcInJvb21fZGVmYXVsdFwiKTtcblxuICAgICAgICAgICAgc29ja2V0LmVtaXQoXCJ3b3JsZFN5bmNcIiwgeyBvYmplY3RSZWNvcmRzIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgR2FtZVNvY2tldHM7IiwiaW1wb3J0IGh0dHAgZnJvbSBcImh0dHBcIjtcbmltcG9ydCBzb2NrZXRJTyBmcm9tIFwic29ja2V0LmlvXCI7XG5pbXBvcnQgQ29uc29sZVNvY2tldHMgZnJvbSBcIi4vY29uc29sZVNvY2tldHNcIjtcbmltcG9ydCBHYW1lU29ja2V0cyBmcm9tIFwiLi9nYW1lU29ja2V0c1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgeyBTb2NrZXRNaWRkbGV3YXJlIH0gZnJvbSBcIi4vdHlwZXMvc29ja2V0TWlkZGxld2FyZVwiO1xuaW1wb3J0IFVzZXIgZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlcy9kYi91c2VyXCI7XG5pbXBvcnQgQXV0aFV0aWwgZnJvbSBcIi4uL3V0aWwvYXV0aFV0aWxcIjtcbmltcG9ydCBOZXR3b3JrVXRpbCBmcm9tIFwiLi4vdXRpbC9uZXR3b3JrVXRpbFwiO1xuaW1wb3J0ICogYXMgY29va2llIGZyb20gXCJjb29raWVcIjtcbmRvdGVudi5jb25maWcoKTtcblxuY29uc3QgY29ubmVjdGVkVXNlck5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFNvY2tldHMoc2VydmVyOiBodHRwLlNlcnZlcilcbntcbiAgICBjb25zdCBpbyA9IG5ldyBzb2NrZXRJTy5TZXJ2ZXIoc2VydmVyKTtcblxuICAgIENvbnNvbGVTb2NrZXRzLmluaXQoaW8sXG4gICAgICAgIChwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCIpXG4gICAgICAgICAgICA/IChfLCBuZXh0KSA9PiBuZXh0KCkgLy8gRG9uJ3QgYXV0aGVudGljYXRlIGluIGRldiBtb2RlXG4gICAgICAgICAgICA6IG1ha2VBdXRoTWlkZGxld2FyZSgodXNlcjogVXNlcikgPT4gdXNlci51c2VyVHlwZSA9PSBcImFkbWluXCIpXG4gICAgKTtcbiAgICBcbiAgICBHYW1lU29ja2V0cy5pbml0KGlvLFxuICAgICAgICBtYWtlQXV0aE1pZGRsZXdhcmUoKHVzZXI6IFVzZXIpID0+IHRydWUpXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gbWFrZUF1dGhNaWRkbGV3YXJlKHBhc3NDb25kaXRpb246ICh1c2VyOiBVc2VyKSA9PiBCb29sZWFuKTogU29ja2V0TWlkZGxld2FyZVxue1xuICAgIHJldHVybiAoc29ja2V0OiBzb2NrZXRJTy5Tb2NrZXQsIG5leHQ6IChlcnI/OiBzb2NrZXRJTy5FeHRlbmRlZEVycm9yKSA9PiB2b2lkKSA9PlxuICAgIHtcbiAgICAgICAgY29uc3QgY29va2llU3RyID0gc29ja2V0LnJlcXVlc3QuaGVhZGVycy5jb29raWU7XG4gICAgICAgIGNvbnNvbGUubG9nKGBBdXRoZW50aWNhdGluZyBzb2NrZXQgKElEOiAke3NvY2tldC5pZH0pYCk7XG4gICAgICAgIGlmICghY29va2llU3RyKVxuICAgICAgICB7XG4gICAgICAgICAgICBuZXh0KG5ldyBFcnJvcihOZXR3b3JrVXRpbC5nZXRFcnJvclBhZ2VVUkwoXCJhdXRoLWZhaWx1cmVcIikpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb29raWVNYXAgPSBjb29raWUucGFyc2UoY29va2llU3RyKTtcbiAgICAgICAgY29uc3QgdG9rZW4gPSBjb29raWVNYXBbXCJ0aGluZ3Nwb29sX3Rva2VuXCJdO1xuICAgICAgICBpZiAoIXRva2VuKVxuICAgICAgICB7XG4gICAgICAgICAgICBuZXh0KG5ldyBFcnJvcihOZXR3b3JrVXRpbC5nZXRFcnJvclBhZ2VVUkwoXCJhdXRoLWZhaWx1cmVcIikpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB1c2VyID0gQXV0aFV0aWwuZ2V0VXNlckZyb21Ub2tlbih0b2tlbik7XG4gICAgICAgIGlmICghdXNlcilcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dChuZXcgRXJyb3IoTmV0d29ya1V0aWwuZ2V0RXJyb3JQYWdlVVJMKFwiYXV0aC1mYWlsdXJlXCIpKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29ubmVjdGVkVXNlck5hbWVzLmhhcyh1c2VyLnVzZXJOYW1lKSlcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dChuZXcgRXJyb3IoTmV0d29ya1V0aWwuZ2V0RXJyb3JQYWdlVVJMKFwiYXV0aC1kdXBsaWNhdGlvblwiKSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwYXNzQ29uZGl0aW9uKHVzZXIpKVxuICAgICAgICB7XG4gICAgICAgICAgICBuZXh0KG5ldyBFcnJvcihOZXR3b3JrVXRpbC5nZXRFcnJvclBhZ2VVUkwoXCJhdXRoLW5vLXBlcm1pc3Npb25cIikpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbm5lY3RlZFVzZXJOYW1lcy5hZGQodXNlci51c2VyTmFtZSk7XG5cbiAgICAgICAgc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWNvbm5lY3RlZFVzZXJOYW1lcy5oYXModXNlci51c2VyTmFtZSkpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVXNlciBcIiR7dXNlci51c2VyTmFtZX1cIiBpcyBhbHJlYWR5IGRpc2Nvbm5lY3RlZC5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25uZWN0ZWRVc2VyTmFtZXMuZGVsZXRlKHVzZXIudXNlck5hbWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBzb2NrZXQuaGFuZHNoYWtlLmF1dGggPSB1c2VyO1xuICAgICAgICBuZXh0KCk7XG4gICAgfVxufSIsImltcG9ydCBGaWxlVXRpbCBmcm9tIFwiLi4vLi4vdXRpbC9maWxlVXRpbFwiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21GZWVkQnVpbGRlclxue1xuICAgIHByaXZhdGUgbGluZXMgPSBbYDwvZmVlZD5gXTtcbiAgICBwcml2YXRlIGdsb2JhbExhdGVzdFVwZGF0ZSA9IG5ldyBEYXRlKHByb2Nlc3MuZW52LkdMT0JBTF9MQVNUX01PRCBhcyBzdHJpbmcpO1xuXG4gICAgYWRkRW50cnkodXJsOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGxhc3Rtb2Q6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZyk6IHZvaWRcbiAgICB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShsYXN0bW9kKTtcbiAgICAgICAgaWYgKGRhdGUgPiB0aGlzLmdsb2JhbExhdGVzdFVwZGF0ZSlcbiAgICAgICAgICAgIHRoaXMuZ2xvYmFsTGF0ZXN0VXBkYXRlID0gZGF0ZTtcblxuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYDwvZW50cnk+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgICA8c3VtbWFyeT4ke2Rlc2NyaXB0aW9ufTwvc3VtbWFyeT5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGAgIDx1cGRhdGVkPiR7ZGF0ZS50b0lTT1N0cmluZygpfTwvdXBkYXRlZD5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGAgIDxpZD4ke3VybH08L2lkPmApOyAvLyBub3QgaWRlYWwgdG8gdXNlIHRoZSB1cmwgYXMgdW5pcXVlIG5ldmVyIGNoYW5naW5nIGlkIGJ1dCB0aGVyZSBpcyBubyBvdGhlciBpZCBmb3IgZWFjaCBhcnRpY2xlLlxuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYCAgPGxpbmsgaHJlZj1cIiR7dXJsfVwiLz5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGAgIDx0aXRsZT4ke3RpdGxlfTwvdGl0bGU+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPGVudHJ5PmApO1xuICAgIH1cblxuICAgIGFzeW5jIGJ1aWxkKCk6IFByb21pc2U8dm9pZD5cbiAgICB7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPGlkPnVybjp1dWlkOjAyMjEwNjcyLTUzOTEtNGNjOC04MDBhLTJhODhmM2E2ZDAwYzwvaWQ+YCk7IC8vIHV1aWQgcmFuZG9tbHkgZ2VuZXJhdGVkXG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPC9hdXRob3I+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgICA8bmFtZT5Zb3VuZ2ppbiBLYW5nPC9uYW1lPmApO1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYDxhdXRob3I+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPHVwZGF0ZWQ+JHt0aGlzLmdsb2JhbExhdGVzdFVwZGF0ZS50b0lTT1N0cmluZygpfTwvdXBkYXRlZD5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGA8bGluayBocmVmPVwiJHtwcm9jZXNzLmVudi5VUkxfU1RBVElDfVwiLz5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGA8bGluayByZWw9XCJzZWxmXCIgdHlwZT1cImFwcGxpY2F0aW9uL2F0b20reG1sXCIgaHJlZj1cIiR7cHJvY2Vzcy5lbnYuVVJMX1NUQVRJQ30vZmVlZC5hdG9tXCIvPmApO1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYDx0aXRsZT5UaGluZ3NQb29sPC90aXRsZT5gKTtcbiAgICAgICAgdGhpcy5saW5lcy5wdXNoKGA8ZmVlZCB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDUvQXRvbVwiPmApO1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYDw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cInV0Zi04XCI/PmApO1xuICAgICAgICB0aGlzLmxpbmVzLnJldmVyc2UoKTtcbiAgICAgICAgYXdhaXQgRmlsZVV0aWwud3JpdGUoYGZlZWQuYXRvbWAsIHRoaXMubGluZXMuam9pbihcIlxcblwiKSk7XG4gICAgfVxufSIsImltcG9ydCBGaWxlVXRpbCBmcm9tIFwiLi4vLi4vdXRpbC9maWxlVXRpbFwiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVtYmVkZGVkU2NyaXB0QnVpbGRlclxue1xuICAgIGFzeW5jIGJ1aWxkKHNvdXJjZURpcj86IHN0cmluZywgdGFyZ2V0RGlyPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPlxuICAgIHtcbiAgICAgICAgaWYgKHNvdXJjZURpciA9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICBzb3VyY2VEaXIgPSBgJHtwcm9jZXNzLmVudi5TUkNfUk9PVF9ESVJ9L3NoYXJlZC9lbWJlZGRlZFNjcmlwdHNgO1xuICAgICAgICBpZiAodGFyZ2V0RGlyID09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIHRhcmdldERpciA9IGAke3Byb2Nlc3MuZW52LlZJRVdTX1JPT1RfRElSfS9wYXJ0aWFsL2VtYmVkZGVkU2NyaXB0YDtcblxuICAgICAgICBsZXQgcmVsYXRpdmVGaWxlUGF0aHMgPSBhd2FpdCBGaWxlVXRpbC5nZXRBbGxSZWxhdGl2ZVBhdGhzSW5EaXJSZWN1cnNpdmVseShzb3VyY2VEaXIpO1xuICAgICAgICByZWxhdGl2ZUZpbGVQYXRocyA9IHJlbGF0aXZlRmlsZVBhdGhzLmZpbHRlcih4ID0+IHguZW5kc1dpdGgoXCIuanNcIikpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVsYXRpdmVGaWxlUGF0aCBvZiByZWxhdGl2ZUZpbGVQYXRocylcbiAgICAgICAge1xuICAgICAgICAgICAgY29uc3Qgc291cmNlQ29kZSA9IChhd2FpdCBGaWxlVXRpbC5yZWFkKHJlbGF0aXZlRmlsZVBhdGgsIHNvdXJjZURpcikpXG4gICAgICAgICAgICAgICAgLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihsaW5lID0+ICFsaW5lLnN0YXJ0c1dpdGgoXCJleHBvcnQgXCIpKSAvLyBSZW1vdmUgJ2V4cG9ydCcgc3RhdGVtZW50cy5cbiAgICAgICAgICAgICAgICAuam9pbihcIlxcblwiKS50cmltKCk7XG5cbiAgICAgICAgICAgIGF3YWl0IEZpbGVVdGlsLndyaXRlKHJlbGF0aXZlRmlsZVBhdGgucmVwbGFjZShcIi5qc1wiLCBcIi5lanNcIiksIGBcbjwlXyBpZiAoIWxvY2Fscy5nbG9iYWxEaWN0aW9uYXJ5W1wic2NyaXB0X2luY2x1ZGVkXygke3JlbGF0aXZlRmlsZVBhdGh9KVwiXSkgeyBfJT5cbjwhLS0gTk9URTogVGhpcyBFSlMgcGFydGlhbCBpcyBhdXRvLWdlbmVyYXRlZCBieSAnZW1iZWRkZWRTY3JpcHRCdWlsZGVyLnRzJyAtLT5cbjwlXyBsb2NhbHMuZ2xvYmFsRGljdGlvbmFyeVtcInNjcmlwdF9pbmNsdWRlZF8oJHtyZWxhdGl2ZUZpbGVQYXRofSlcIl0gPSB0cnVlOyBfJT5cbjxzY3JpcHQ+XG4ke3NvdXJjZUNvZGV9XG48L3NjcmlwdD5cbjwlXyB9IF8lPlxuYC50cmltKCksIHRhcmdldERpcik7XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IEZpbGVVdGlsIGZyb20gXCIuLi8uLi8uLi91dGlsL2ZpbGVVdGlsXCI7XG5pbXBvcnQgRUpTVXRpbCBmcm9tIFwiLi4vLi4vLi4vdXRpbC9lanNVdGlsXCI7XG5pbXBvcnQgVGV4dEZpbGVCdWlsZGVyIGZyb20gXCIuLi90ZXh0RmlsZUJ1aWxkZXJcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IFNpdGVtYXBCdWlsZGVyIGZyb20gXCIuLi9zaXRlbWFwQnVpbGRlclwiO1xuaW1wb3J0IEF0b21GZWVkQnVpbGRlciBmcm9tIFwiLi4vYXRvbUZlZWRCdWlsZGVyXCI7XG5pbXBvcnQgR2FtZUVudHJ5IGZyb20gXCIuLi8uLi90eXBlcy9nYW1lRW50cnlcIlxuZG90ZW52LmNvbmZpZygpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBcmNhZGVHYW1lUGFnZUJ1aWxkZXJcbntcbiAgICBwcml2YXRlIHNpdGVtYXBCdWlsZGVyOiBTaXRlbWFwQnVpbGRlcjtcbiAgICBwcml2YXRlIGF0b21GZWVkQnVpbGRlcjogQXRvbUZlZWRCdWlsZGVyO1xuXG4gICAgY29uc3RydWN0b3Ioc2l0ZW1hcEJ1aWxkZXI6IFNpdGVtYXBCdWlsZGVyLCBhdG9tRmVlZEJ1aWxkZXI6IEF0b21GZWVkQnVpbGRlcilcbiAgICB7XG4gICAgICAgIHRoaXMuc2l0ZW1hcEJ1aWxkZXIgPSBzaXRlbWFwQnVpbGRlcjtcbiAgICAgICAgdGhpcy5hdG9tRmVlZEJ1aWxkZXIgPSBhdG9tRmVlZEJ1aWxkZXI7XG4gICAgfVxuXG4gICAgYXN5bmMgYnVpbGQoZW50cnk6IEdhbWVFbnRyeSk6IFByb21pc2U8dm9pZD5cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlVVJMID0gYCR7ZW50cnkuZGlyTmFtZX0vcGFnZS5odG1sYDtcbiAgICAgICAgY29uc3QgcmF3VGV4dCA9IGF3YWl0IEZpbGVVdGlsLnJlYWQoYCR7ZW50cnkuZGlyTmFtZX0vc291cmNlLnR4dGApO1xuICAgICAgICBjb25zdCBsaW5lcyA9IHJhd1RleHQuc3BsaXQoL1xccj9cXG4vKTtcblxuICAgICAgICBjb25zdCBwbGF5TGlua0ltYWdlUGF0aCA9IChlbnRyeS5wbGF5TGlua0ltYWdlUGF0aE92ZXJyaWRlID09IHVuZGVmaW5lZCkgPyBcInBsYXkucG5nXCIgOiBlbnRyeS5wbGF5TGlua0ltYWdlUGF0aE92ZXJyaWRlO1xuXG4gICAgICAgIGxldCBkZXNjcmlwdGlvbiA9IFwiXCI7XG4gICAgICAgIGxldCBrZXl3b3JkcyA9IFwiXCI7XG5cbiAgICAgICAgaWYgKGxpbmVzWzBdLnN0YXJ0c1dpdGgoXCI6ZDpcIikpXG4gICAgICAgICAgICBkZXNjcmlwdGlvbiA9IGxpbmVzWzBdLnN1YnN0cmluZygzKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIjpkOiBpcyBtaXNzaW5nIGluIC0+IFwiICsgZW50cnkudGl0bGUpO1xuXG4gICAgICAgIGlmIChsaW5lc1sxXS5zdGFydHNXaXRoKFwiOms6XCIpKVxuICAgICAgICAgICAga2V5d29yZHMgPSBsaW5lc1sxXS5zdWJzdHJpbmcoMykudG9Mb3dlckNhc2UoKS5yZXBsYWNlQWxsKFwiLVwiLCBcIiBcIik7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCI6azogaXMgbWlzc2luZyBpbiAtPiBcIiArIGVudHJ5LnRpdGxlKTtcblxuICAgICAgICBjb25zdCBjb250ZW50TGluZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgbGV0IGltYWdlSW5kZXggPSAxO1xuICAgICAgICBjb25zdCBwYXJhZ3JhcGhMaW5lc1BlbmRpbmc6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgY29uc3QgZW5kUGFyYWdyYXBoID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBhcmFncmFwaExpbmVzUGVuZGluZy5sZW5ndGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGA8cD4ke3BhcmFncmFwaExpbmVzUGVuZGluZy5qb2luKFwiPGJyPlwiKX08L3A+YCk7XG4gICAgICAgICAgICAgICAgcGFyYWdyYXBoTGluZXNQZW5kaW5nLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMjsgaSA8IGxpbmVzLmxlbmd0aDsgKytpKVxuICAgICAgICB7XG4gICAgICAgICAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgICAgICAgbGluZSA9IGxpbmUudHJpbSgpO1xuXG4gICAgICAgICAgICBpZiAobGluZS5sZW5ndGggPT0gMCkgLy8gZW1wdHkgbGluZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGVuZFBhcmFncmFwaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKFwiW1wiKSkgLy8gUGFyYWdyYXBoIFRpdGxlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyYWdyYXBoVGl0bGUgPSAobGluZS5tYXRjaCgvXFxbKC4qPylcXF0vKSBhcyBzdHJpbmdbXSlbMV0udHJpbSgpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJhZ3JhcGhUaXRsZS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExpbmVzLnB1c2goYDxoMj4ke3BhcmFncmFwaFRpdGxlfTwvaDI+YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKFwiPFwiKSkgLy8gaW1hZ2UgcmVmZXJlbmNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW1nTmFtZSA9IChsaW5lLm1hdGNoKC88KC4qPyk+LykgYXMgc3RyaW5nW10pWzFdO1xuICAgICAgICAgICAgICAgIGlmIChpbWdOYW1lLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWdQYXRoID0gYCR7cHJvY2Vzcy5lbnYuVVJMX1NUQVRJQ30vJHtlbnRyeS5kaXJOYW1lfS8ke2ltZ05hbWV9LmpwZ2A7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGA8aW1nIGNsYXNzPVwibF9pbWFnZVwiIHNyYz1cIiR7aW1nUGF0aH1cIiBhbHQ9XCJUaGluZ3NQb29sIC0gJHtlbnRyeS50aXRsZX0gKFNjcmVlbnNob3QgJHtpbWFnZUluZGV4Kyt9KVwiPmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgLy8gcGxhaW4gdGV4dFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxpbmUgPSBsaW5lLnJlcGxhY2VBbGwoXCI8XCIsIFwiJmx0O1wiKS5yZXBsYWNlQWxsKFwiPlwiLCBcIiZndDtcIikucmVwbGFjZUFsbChcInslXCIsIFwiPFwiKS5yZXBsYWNlQWxsKFwiJX1cIiwgXCI+XCIpO1xuICAgICAgICAgICAgICAgIHBhcmFncmFwaExpbmVzUGVuZGluZy5wdXNoKGxpbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVuZFBhcmFncmFwaCgpO1xuICAgICAgICBpZiAoZW50cnkudmlkZW9UYWcgIT0gbnVsbCAmJiBlbnRyeS52aWRlb1RhZyAhPSB1bmRlZmluZWQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGVudHJ5LnZpZGVvVGFnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgVGV4dEZpbGVCdWlsZGVyKCk7XG5cbiAgICAgICAgYnVpbGRlci5hZGRMaW5lKGF3YWl0IEVKU1V0aWwuY3JlYXRlU3RhdGljSFRNTEZyb21FSlMoXCJwYWdlL3N0YXRpYy9hcmNhZGVHYW1lLmVqc1wiLCB7XG4gICAgICAgICAgICBlbnRyeSwgcmVsYXRpdmVVUkwsIGRlc2NyaXB0aW9uLCBrZXl3b3JkcywgcGxheUxpbmtJbWFnZVBhdGgsIGNvbnRlbnQ6IGNvbnRlbnRMaW5lcy5qb2luKFwiXFxuXCIpXG4gICAgICAgIH0pKTtcblxuICAgICAgICB0aGlzLnNpdGVtYXBCdWlsZGVyLmFkZEVudHJ5KHJlbGF0aXZlVVJMLCBlbnRyeS5sYXN0bW9kKTtcbiAgICAgICAgdGhpcy5hdG9tRmVlZEJ1aWxkZXIuYWRkRW50cnkoYCR7cHJvY2Vzcy5lbnYuVVJMX1NUQVRJQ30vJHtyZWxhdGl2ZVVSTH1gLCBlbnRyeS50aXRsZSwgZW50cnkubGFzdG1vZCwgZW50cnkudGl0bGUpO1xuXG4gICAgICAgIGF3YWl0IGJ1aWxkZXIuYnVpbGQocmVsYXRpdmVVUkwpO1xuICAgIH07XG59IiwiaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uLy4uLy4uL3V0aWwvZWpzVXRpbFwiO1xuaW1wb3J0IFRleHRGaWxlQnVpbGRlciBmcm9tIFwiLi4vdGV4dEZpbGVCdWlsZGVyXCI7XG5pbXBvcnQgQXJjYWRlR2FtZVBhZ2VCdWlsZGVyIGZyb20gXCIuL2FyY2FkZUdhbWVQYWdlQnVpbGRlclwiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgU2l0ZW1hcEJ1aWxkZXIgZnJvbSBcIi4uL3NpdGVtYXBCdWlsZGVyXCI7XG5pbXBvcnQgQXRvbUZlZWRCdWlsZGVyIGZyb20gXCIuLi9hdG9tRmVlZEJ1aWxkZXJcIjtcbmltcG9ydCB7IEFyY2FkZURhdGEgfSBmcm9tIFwiLi4vLi4vZGF0YS9hcmNhZGVEYXRhXCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFyY2FkZVBhZ2VCdWlsZGVyXG57XG4gICAgcHJpdmF0ZSBzaXRlbWFwQnVpbGRlcjogU2l0ZW1hcEJ1aWxkZXI7XG4gICAgcHJpdmF0ZSBhdG9tRmVlZEJ1aWxkZXI6IEF0b21GZWVkQnVpbGRlcjtcblxuICAgIGNvbnN0cnVjdG9yKHNpdGVtYXBCdWlsZGVyOiBTaXRlbWFwQnVpbGRlciwgYXRvbUZlZWRCdWlsZGVyOiBBdG9tRmVlZEJ1aWxkZXIpXG4gICAge1xuICAgICAgICB0aGlzLnNpdGVtYXBCdWlsZGVyID0gc2l0ZW1hcEJ1aWxkZXI7XG4gICAgICAgIHRoaXMuYXRvbUZlZWRCdWlsZGVyID0gYXRvbUZlZWRCdWlsZGVyO1xuICAgIH1cbiAgICBcbiAgICBhc3luYyBidWlsZCgpOiBQcm9taXNlPHZvaWQ+XG4gICAge1xuICAgICAgICBjb25zdCBidWlsZGVyID0gbmV3IFRleHRGaWxlQnVpbGRlcigpO1xuXG4gICAgICAgIGJ1aWxkZXIuYWRkTGluZShhd2FpdCBFSlNVdGlsLmNyZWF0ZVN0YXRpY0hUTUxGcm9tRUpTKFwicGFnZS9zdGF0aWMvYXJjYWRlLmVqc1wiLCB7XG4gICAgICAgICAgICBlbnRyaWVzOiBBcmNhZGVEYXRhLmdhbWVFbnRyaWVzLFxuICAgICAgICB9KSk7XG4gICAgICAgIGF3YWl0IGJ1aWxkZXIuYnVpbGQoXCJhcmNhZGUuaHRtbFwiKTtcblxuICAgICAgICB0aGlzLnNpdGVtYXBCdWlsZGVyLmFkZEVudHJ5KFwiYXJjYWRlLmh0bWxcIiwgXCIyMDI1LTAyLTI4XCIpO1xuXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgQXJjYWRlRGF0YS5nYW1lRW50cmllcylcbiAgICAgICAgICAgIGF3YWl0IG5ldyBBcmNhZGVHYW1lUGFnZUJ1aWxkZXIodGhpcy5zaXRlbWFwQnVpbGRlciwgdGhpcy5hdG9tRmVlZEJ1aWxkZXIpLmJ1aWxkKGVudHJ5KTtcbiAgICB9XG59IiwiaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uLy4uLy4uL3V0aWwvZWpzVXRpbFwiO1xuaW1wb3J0IEZpbGVVdGlsIGZyb20gXCIuLi8uLi8uLi91dGlsL2ZpbGVVdGlsXCI7XG5pbXBvcnQgVGV4dEZpbGVCdWlsZGVyIGZyb20gXCIuLi90ZXh0RmlsZUJ1aWxkZXJcIlxuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVycm9yUGFnZUJ1aWxkZXJcbntcbiAgICBhc3luYyBidWlsZChzb3VyY2VEaXI/OiBzdHJpbmcsIHRhcmdldERpcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD5cbiAgICB7XG4gICAgICAgIGlmIChzb3VyY2VEaXIgPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgc291cmNlRGlyID0gYCR7cHJvY2Vzcy5lbnYuVklFV1NfUk9PVF9ESVJ9L3BhZ2Uvc3RhdGljL2Vycm9yYDtcbiAgICAgICAgaWYgKHRhcmdldERpciA9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICB0YXJnZXREaXIgPSBgJHtwcm9jZXNzLmVudi5TVEFUSUNfUEFHRV9ST09UX0RJUn0vZXJyb3JgO1xuXG4gICAgICAgIGxldCByZWxhdGl2ZUZpbGVQYXRocyA9IGF3YWl0IEZpbGVVdGlsLmdldEFsbFJlbGF0aXZlUGF0aHNJbkRpclJlY3Vyc2l2ZWx5KHNvdXJjZURpcik7XG4gICAgICAgIHJlbGF0aXZlRmlsZVBhdGhzID0gcmVsYXRpdmVGaWxlUGF0aHMuZmlsdGVyKHggPT4geC5lbmRzV2l0aChcIi5lanNcIikpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVsYXRpdmVGaWxlUGF0aCBvZiByZWxhdGl2ZUZpbGVQYXRocylcbiAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBUZXh0RmlsZUJ1aWxkZXIoKTtcbiAgICAgICAgICAgIGJ1aWxkZXIuYWRkTGluZShhd2FpdCBFSlNVdGlsLmNyZWF0ZVN0YXRpY0hUTUxGcm9tRUpTKFwiL3BhZ2Uvc3RhdGljL2Vycm9yL1wiICsgcmVsYXRpdmVGaWxlUGF0aCwge30pKTtcblxuICAgICAgICAgICAgYXdhaXQgYnVpbGRlci5idWlsZChyZWxhdGl2ZUZpbGVQYXRoLnJlcGxhY2UoXCIuZWpzXCIsIFwiLmh0bWxcIiksIHRhcmdldERpcik7XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uLy4uLy4uL3V0aWwvZWpzVXRpbFwiO1xuaW1wb3J0IFRleHRGaWxlQnVpbGRlciBmcm9tIFwiLi4vdGV4dEZpbGVCdWlsZGVyXCI7XG5pbXBvcnQgTGlicmFyeVBvc3RMaXN0UGFnZUJ1aWxkZXIgZnJvbSBcIi4vbGlicmFyeVBvc3RMaXN0UGFnZUJ1aWxkZXJcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IFNpdGVtYXBCdWlsZGVyIGZyb20gXCIuLi9zaXRlbWFwQnVpbGRlclwiO1xuaW1wb3J0IEF0b21GZWVkQnVpbGRlciBmcm9tIFwiLi4vYXRvbUZlZWRCdWlsZGVyXCI7XG5pbXBvcnQgeyBMaWJyYXJ5RGF0YSB9IGZyb20gXCIuLi8uLi9kYXRhL2xpYnJhcnlEYXRhXCI7XG5pbXBvcnQgeyBBcmNhZGVEYXRhIH0gZnJvbSBcIi4uLy4uL2RhdGEvYXJjYWRlRGF0YVwiO1xuZG90ZW52LmNvbmZpZygpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMaWJyYXJ5UGFnZUJ1aWxkZXJcbntcbiAgICBwcml2YXRlIHNpdGVtYXBCdWlsZGVyOiBTaXRlbWFwQnVpbGRlcjtcbiAgICBwcml2YXRlIGF0b21GZWVkQnVpbGRlcjogQXRvbUZlZWRCdWlsZGVyO1xuXG4gICAgY29uc3RydWN0b3Ioc2l0ZW1hcEJ1aWxkZXI6IFNpdGVtYXBCdWlsZGVyLCBhdG9tRmVlZEJ1aWxkZXI6IEF0b21GZWVkQnVpbGRlcilcbiAgICB7XG4gICAgICAgIHRoaXMuc2l0ZW1hcEJ1aWxkZXIgPSBzaXRlbWFwQnVpbGRlcjtcbiAgICAgICAgdGhpcy5hdG9tRmVlZEJ1aWxkZXIgPSBhdG9tRmVlZEJ1aWxkZXI7XG4gICAgfVxuXG4gICAgYXN5bmMgYnVpbGQoKTogUHJvbWlzZTx2b2lkPlxuICAgIHtcbiAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBUZXh0RmlsZUJ1aWxkZXIoKTtcblxuICAgICAgICBidWlsZGVyLmFkZExpbmUoYXdhaXQgRUpTVXRpbC5jcmVhdGVTdGF0aWNIVE1MRnJvbUVKUyhcInBhZ2Uvc3RhdGljL2xpYnJhcnkuZWpzXCIsIHtcbiAgICAgICAgICAgIGVudHJpZXNCeUNhdGVnb3J5OiBMaWJyYXJ5RGF0YS5lbnRyaWVzQnlDYXRlZ29yeSxcbiAgICAgICAgICAgIGdhbWVFbnRyaWVzOiBBcmNhZGVEYXRhLmdhbWVFbnRyaWVzLFxuICAgICAgICB9KSk7XG4gICAgICAgIGF3YWl0IGJ1aWxkZXIuYnVpbGQoXCJsaWJyYXJ5Lmh0bWxcIik7XG5cbiAgICAgICAgdGhpcy5zaXRlbWFwQnVpbGRlci5hZGRFbnRyeShcImxpYnJhcnkuaHRtbFwiLCBcIjIwMjUtMDItMjhcIik7XG5cbiAgICAgICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIGVudHJpZXNdIG9mIE9iamVjdC5lbnRyaWVzKExpYnJhcnlEYXRhLmVudHJpZXNCeUNhdGVnb3J5KSlcbiAgICAgICAgICAgIGF3YWl0IG5ldyBMaWJyYXJ5UG9zdExpc3RQYWdlQnVpbGRlcih0aGlzLnNpdGVtYXBCdWlsZGVyLCB0aGlzLmF0b21GZWVkQnVpbGRlcikuYnVpbGQoY2F0ZWdvcnksIGVudHJpZXMpO1xuICAgIH1cbn0iLCJpbXBvcnQgRUpTVXRpbCBmcm9tIFwiLi4vLi4vLi4vdXRpbC9lanNVdGlsXCI7XG5pbXBvcnQgVGV4dEZpbGVCdWlsZGVyIGZyb20gXCIuLi90ZXh0RmlsZUJ1aWxkZXJcIjtcbmltcG9ydCBMaWJyYXJ5UG9zdFBhZ2VCdWlsZGVyIGZyb20gXCIuL2xpYnJhcnlQb3N0UGFnZUJ1aWxkZXJcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IFNpdGVtYXBCdWlsZGVyIGZyb20gXCIuLi9zaXRlbWFwQnVpbGRlclwiO1xuaW1wb3J0IEF0b21GZWVkQnVpbGRlciBmcm9tIFwiLi4vYXRvbUZlZWRCdWlsZGVyXCI7XG5pbXBvcnQgUG9zdEVudHJ5IGZyb20gXCIuLi8uLi90eXBlcy9wb3N0RW50cnlcIjtcbmRvdGVudi5jb25maWcoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTGlicmFyeVBvc3RMaXN0UGFnZUJ1aWxkZXJcbntcbiAgICBwcml2YXRlIHNpdGVtYXBCdWlsZGVyOiBTaXRlbWFwQnVpbGRlcjtcbiAgICBwcml2YXRlIGF0b21GZWVkQnVpbGRlcjogQXRvbUZlZWRCdWlsZGVyO1xuXG4gICAgY29uc3RydWN0b3Ioc2l0ZW1hcEJ1aWxkZXI6IFNpdGVtYXBCdWlsZGVyLCBhdG9tRmVlZEJ1aWxkZXI6IEF0b21GZWVkQnVpbGRlcilcbiAgICB7XG4gICAgICAgIHRoaXMuc2l0ZW1hcEJ1aWxkZXIgPSBzaXRlbWFwQnVpbGRlcjtcbiAgICAgICAgdGhpcy5hdG9tRmVlZEJ1aWxkZXIgPSBhdG9tRmVlZEJ1aWxkZXI7XG4gICAgfVxuICAgIFxuICAgIGFzeW5jIGJ1aWxkKGNhdGVnb3J5OiBzdHJpbmcsIGVudHJpZXM6IFBvc3RFbnRyeVtdKTogUHJvbWlzZTx2b2lkPlxuICAgIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyaWVzLmxlbmd0aDsgKytpKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IGVudHJpZXNbaV07XG4gICAgICAgICAgICBjb25zdCBwb3N0SW5mb0xpc3QgPSBhd2FpdCBuZXcgTGlicmFyeVBvc3RQYWdlQnVpbGRlcih0aGlzLnNpdGVtYXBCdWlsZGVyLCB0aGlzLmF0b21GZWVkQnVpbGRlcikuYnVpbGQoZW50cnkpO1xuICAgICAgICAgICAgY29uc3QgbGlzdFJlbGF0aXZlVVJMID0gYCR7ZW50cnkuZGlyTmFtZX0vbGlzdC5odG1sYDtcblxuICAgICAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBUZXh0RmlsZUJ1aWxkZXIoKTtcblxuICAgICAgICAgICAgYnVpbGRlci5hZGRMaW5lKGF3YWl0IEVKU1V0aWwuY3JlYXRlU3RhdGljSFRNTEZyb21FSlMoXCJwYWdlL3N0YXRpYy9saWJyYXJ5UG9zdExpc3QuZWpzXCIsIHtcbiAgICAgICAgICAgICAgICBlbnRyeSwgbGlzdFJlbGF0aXZlVVJMLCBwb3N0SW5mb0xpc3RcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgYXdhaXQgYnVpbGRlci5idWlsZChgJHtlbnRyeS5kaXJOYW1lfS9saXN0Lmh0bWxgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5zaXRlbWFwQnVpbGRlci5hZGRFbnRyeShgJHtlbnRyeS5kaXJOYW1lfS9saXN0Lmh0bWxgLFxuICAgICAgICAgICAgICAgIHBvc3RJbmZvTGlzdFxuICAgICAgICAgICAgICAgICAgICAuc29ydCgoaW5mbzEsIGluZm8yKSA9PiBEYXRlLnBhcnNlKGluZm8yLmxhc3Rtb2QpIC0gRGF0ZS5wYXJzZShpbmZvMS5sYXN0bW9kKSlcbiAgICAgICAgICAgICAgICAgICAgLnBvcCgpIS5sYXN0bW9kXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfTtcbn0iLCJpbXBvcnQgRmlsZVV0aWwgZnJvbSBcIi4uLy4uLy4uL3V0aWwvZmlsZVV0aWxcIjtcbmltcG9ydCBFSlNVdGlsIGZyb20gXCIuLi8uLi8uLi91dGlsL2Vqc1V0aWxcIjtcbmltcG9ydCBUZXh0RmlsZUJ1aWxkZXIgZnJvbSBcIi4uL3RleHRGaWxlQnVpbGRlclwiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgU2l0ZW1hcEJ1aWxkZXIgZnJvbSBcIi4uL3NpdGVtYXBCdWlsZGVyXCI7XG5pbXBvcnQgQXRvbUZlZWRCdWlsZGVyIGZyb20gXCIuLi9hdG9tRmVlZEJ1aWxkZXJcIjtcbmltcG9ydCBQb3N0RW50cnkgZnJvbSBcIi4uLy4uL3R5cGVzL3Bvc3RFbnRyeVwiXG5pbXBvcnQgUG9zdEluZm8gZnJvbSBcIi4uLy4uL3R5cGVzL3Bvc3RJbmZvXCJcbmRvdGVudi5jb25maWcoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTGlicmFyeVBvc3RQYWdlQnVpbGRlclxue1xuICAgIHByaXZhdGUgc2l0ZW1hcEJ1aWxkZXI6IFNpdGVtYXBCdWlsZGVyO1xuICAgIHByaXZhdGUgYXRvbUZlZWRCdWlsZGVyOiBBdG9tRmVlZEJ1aWxkZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzaXRlbWFwQnVpbGRlcjogU2l0ZW1hcEJ1aWxkZXIsIGF0b21GZWVkQnVpbGRlcjogQXRvbUZlZWRCdWlsZGVyKVxuICAgIHtcbiAgICAgICAgdGhpcy5zaXRlbWFwQnVpbGRlciA9IHNpdGVtYXBCdWlsZGVyO1xuICAgICAgICB0aGlzLmF0b21GZWVkQnVpbGRlciA9IGF0b21GZWVkQnVpbGRlcjtcbiAgICB9XG5cbiAgICBhc3luYyBidWlsZChlbnRyeTogUG9zdEVudHJ5KTogUHJvbWlzZTxQb3N0SW5mb1tdPlxuICAgIHtcbiAgICAgICAgbGV0IGlzRmlyc3RBcnRpY2xlID0gdHJ1ZTtcbiAgICAgICAgbGV0IHRpdGxlID0gXCI/Pz9cIjtcbiAgICAgICAgbGV0IHBhZ2VOdW1iZXIgPSAxO1xuICAgICAgICBsZXQgaW1hZ2VOdW1iZXIgPSAxO1xuICAgICAgICBsZXQgY3VzdG9tT0dJbWFnZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IHNuaXBwZXRPbiA9IGZhbHNlO1xuICAgICAgICBsZXQgZXhjZXJwdE9uID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHBhcmFncmFwaExpbmVzUGVuZGluZzogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICBjb25zdCBwb3N0SW5mb0xpc3Q6IFBvc3RJbmZvW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGxldCBjb250ZW50TGluZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgbGV0IGRlc2MgPSBcIkEgd3JpdGluZyBieSBUaGluZ3NQb29sLlwiO1xuICAgICAgICBsZXQga2V5d29yZHMgPSBcInRoaW5nc3Bvb2wsIHNvZnR3YXJlLCBlbmdpbmVlcmluZywgcGhpbG9zb3BoeVwiO1xuICAgICAgICBsZXQgbGFzdG1vZCA9IHByb2Nlc3MuZW52LkdMT0JBTF9MQVNUX01PRCBhcyBzdHJpbmc7XG5cbiAgICAgICAgbGV0IHByZXZfdGl0bGUgPSB0aXRsZTtcbiAgICAgICAgbGV0IHByZXZfZGVzYyA9IGRlc2M7XG4gICAgICAgIGxldCBwcmV2X2tleXdvcmRzID0ga2V5d29yZHM7XG4gICAgICAgIGxldCBwcmV2X2xhc3Rtb2QgPSBsYXN0bW9kO1xuXG4gICAgICAgIGNvbnN0IGVuZFBhcmFncmFwaCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChwYXJhZ3JhcGhMaW5lc1BlbmRpbmcubGVuZ3RoID4gMClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZiAoc25pcHBldE9uKVxuICAgICAgICAgICAgICAgICAgICBjb250ZW50TGluZXMucHVzaChgPGRpdiBjbGFzcz1cInNuaXBwZXRcIj48cHJlPjxjb2RlPiR7cGFyYWdyYXBoTGluZXNQZW5kaW5nLmpvaW4oXCJcXG5cIil9PC9jb2RlPjwvcHJlPjwvZGl2PmApO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGV4Y2VycHRPbilcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExpbmVzLnB1c2goYDxwcmU+PGRpdiBjbGFzcz1cImV4Y2VycHRcIj4ke3BhcmFncmFwaExpbmVzUGVuZGluZy5qb2luKFwiXFxuXCIpfTwvZGl2PjwvcHJlPmApO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExpbmVzLnB1c2goYDxwPiR7cGFyYWdyYXBoTGluZXNQZW5kaW5nLmpvaW4oXCI8YnI+XCIpfTwvcD5gKTtcbiAgICAgICAgICAgICAgICBwYXJhZ3JhcGhMaW5lc1BlbmRpbmcubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBidWlsZFBvc3RQYWdlID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcsIGxhc3Rtb2Q6IHN0cmluZywgZGVzYzogc3RyaW5nLCBrZXl3b3Jkczogc3RyaW5nLCBpc0xhc3RQYWdlOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwb3N0UmVsYXRpdmVVUkwgPSBgJHtlbnRyeS5kaXJOYW1lfS9wYWdlLSR7cGFnZU51bWJlcn0uaHRtbGA7XG5cbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgVGV4dEZpbGVCdWlsZGVyKCk7XG4gICAgICAgICAgICBidWlsZGVyLmFkZExpbmUoYXdhaXQgRUpTVXRpbC5jcmVhdGVTdGF0aWNIVE1MRnJvbUVKUyhcInBhZ2Uvc3RhdGljL2xpYnJhcnlQb3N0LmVqc1wiLCB7XG4gICAgICAgICAgICAgICAgdGl0bGUsIGRlc2MsIGtleXdvcmRzLCBjdXN0b21PR0ltYWdlUGF0aCwgZW50cnksIHBhZ2VOdW1iZXIsXG4gICAgICAgICAgICAgICAgaXNMYXN0UGFnZSwgY29udGVudDogY29udGVudExpbmVzLmpvaW4oXCJcXG5cIiksXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIGF3YWl0IGJ1aWxkZXIuYnVpbGQocG9zdFJlbGF0aXZlVVJMKTtcbiAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICB0aGlzLnNpdGVtYXBCdWlsZGVyLmFkZEVudHJ5KHBvc3RSZWxhdGl2ZVVSTCwgbGFzdG1vZCk7XG4gICAgICAgICAgICB0aGlzLmF0b21GZWVkQnVpbGRlci5hZGRFbnRyeShgJHtwcm9jZXNzLmVudi5VUkxfU1RBVElDfS8ke3Bvc3RSZWxhdGl2ZVVSTH1gLCB0aXRsZSwgbGFzdG1vZCwgZGVzYyk7XG5cbiAgICAgICAgICAgIHBvc3RJbmZvTGlzdC5wdXNoKHsgcGFnZU51bWJlciwgdGl0bGUsIGxhc3Rtb2QsIGRlc2MsIGtleXdvcmRzLCBjdXN0b21PR0ltYWdlUGF0aCB9KTtcbiAgICAgICAgICAgIHBhZ2VOdW1iZXIrKztcbiAgICAgICAgICAgIGltYWdlTnVtYmVyID0gMTtcbiAgICAgICAgICAgIGN1c3RvbU9HSW1hZ2VQYXRoID0gdW5kZWZpbmVkO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJhd1RleHQgPSBhd2FpdCBGaWxlVXRpbC5yZWFkKGAke2VudHJ5LmRpck5hbWV9L3NvdXJjZS50eHRgKTtcbiAgICAgICAgY29uc3QgbGluZXMgPSByYXdUZXh0LnNwbGl0KC9cXHI/XFxuLyk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7ICsraSlcbiAgICAgICAge1xuICAgICAgICAgICAgbGV0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgICAgICAgIGlmICghc25pcHBldE9uICYmICFleGNlcnB0T24pXG4gICAgICAgICAgICAgICAgbGluZSA9IGxpbmUudHJpbSgpO1xuXG4gICAgICAgICAgICBpZiAobGluZS5sZW5ndGggPT0gMCkgLy8gZW1wdHkgbGluZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmIChzbmlwcGV0T24gfHwgZXhjZXJwdE9uKVxuICAgICAgICAgICAgICAgICAgICBwYXJhZ3JhcGhMaW5lc1BlbmRpbmcucHVzaChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGVuZFBhcmFncmFwaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKFwiW1wiKSkgLy8gaGVhZGVyXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0ZpcnN0QXJ0aWNsZSlcbiAgICAgICAgICAgICAgICAgICAgcHJldl90aXRsZSA9IHRpdGxlO1xuICAgICAgICAgICAgICAgIHRpdGxlID0gKGxpbmUubWF0Y2goL1xcWyguKj8pXFxdLykgYXMgc3RyaW5nW10pWzFdLnRyaW0oKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGUgPSAobGluZS5tYXRjaCgvXFxdKC4qPykkLykgYXMgc3RyaW5nW10pWzFdLnRyaW0oKTtcblxuICAgICAgICAgICAgICAgIGlmICghaXNGaXJzdEFydGljbGUpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBidWlsZFBvc3RQYWdlKHByZXZfdGl0bGUsIHByZXZfbGFzdG1vZCwgcHJldl9kZXNjLCBwcmV2X2tleXdvcmRzLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHByZXZfZGVzYyA9IGRlc2M7XG4gICAgICAgICAgICAgICAgICAgIHByZXZfa2V5d29yZHMgPSBrZXl3b3JkcztcbiAgICAgICAgICAgICAgICAgICAgcHJldl9sYXN0bW9kID0gbGFzdG1vZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaXNGaXJzdEFydGljbGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGA8aDE+JHt0aXRsZX08L2gxPmApO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGA8cCBjbGFzcz1cImRpbVwiPkF1dGhvcjogWW91bmdqaW4gS2FuZyZuYnNwOyZuYnNwOyZuYnNwO0RhdGU6ICR7ZGF0ZX08L3A+YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoXCI8XCIpICYmICFzbmlwcGV0T24gJiYgIWV4Y2VycHRPbikgLy8gaW1hZ2UgcmVmZXJlbmNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW1nTmFtZSA9IChsaW5lLm1hdGNoKC88KC4qPyk+LykgYXMgc3RyaW5nW10pWzFdO1xuICAgICAgICAgICAgICAgIGlmIChpbWdOYW1lLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWdQYXRoID0gYCR7cHJvY2Vzcy5lbnYuVVJMX1NUQVRJQ30vJHtlbnRyeS5kaXJOYW1lfS8ke2ltZ05hbWV9LmpwZ2A7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXN0b21PR0ltYWdlUGF0aCA9PSB1bmRlZmluZWQgfHwgbGluZS5lbmRzV2l0aChcIipcIikpXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21PR0ltYWdlUGF0aCA9IGltZ1BhdGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGA8aW1nIGNsYXNzPVwibF9pbWFnZVwiIHNyYz1cIiR7aW1nUGF0aH1cIiBhbHQ9XCIke3RpdGxlLnJlcGxhY2VBbGwoXCJcXFwiXCIsIFwiJnF1b3Q7XCIpfSAoRmlndXJlICR7aW1hZ2VOdW1iZXIrK30pXCI+YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKFwiQEBcIikpIC8vIEN1c3RvbSBIVE1MIHRhZ1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKGxpbmUuc3Vic3RyaW5nKDIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aChcIiMkXCIpKSAvLyBzbmlwcGV0XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgc25pcHBldE9uID0gIXNuaXBwZXRPbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aChcIiNcXFwiXCIpKSAvLyBleGNlcnB0XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kUGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgZXhjZXJwdE9uID0gIWV4Y2VycHRPbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aChcIjpkOlwiKSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRmlyc3RBcnRpY2xlKVxuICAgICAgICAgICAgICAgICAgICBwcmV2X2Rlc2MgPSBkZXNjO1xuICAgICAgICAgICAgICAgIGRlc2MgPSBsaW5lLnN1YnN0cmluZygzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aChcIjprOlwiKSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRmlyc3RBcnRpY2xlKVxuICAgICAgICAgICAgICAgICAgICBwcmV2X2tleXdvcmRzID0ga2V5d29yZHM7XG4gICAgICAgICAgICAgICAga2V5d29yZHMgPSBsaW5lLnN1YnN0cmluZygzKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2VBbGwoXCItXCIsIFwiIFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aChcIjpsOlwiKSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRmlyc3RBcnRpY2xlKVxuICAgICAgICAgICAgICAgICAgICBwcmV2X2xhc3Rtb2QgPSBsYXN0bW9kO1xuICAgICAgICAgICAgICAgIGxhc3Rtb2QgPSBsaW5lLnN1YnN0cmluZygzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgLy8gcGxhaW4gdGV4dFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxpbmUgPSBsaW5lLnJlcGxhY2VBbGwoXCI8XCIsIFwiJmx0O1wiKS5yZXBsYWNlQWxsKFwiPlwiLCBcIiZndDtcIikucmVwbGFjZUFsbChcInslXCIsIFwiPFwiKS5yZXBsYWNlQWxsKFwiJX1cIiwgXCI+XCIpO1xuICAgICAgICAgICAgICAgIHBhcmFncmFwaExpbmVzUGVuZGluZy5wdXNoKGxpbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVuZFBhcmFncmFwaCgpO1xuXG4gICAgICAgIGF3YWl0IGJ1aWxkUG9zdFBhZ2UodGl0bGUsIGxhc3Rtb2QsIGRlc2MsIGtleXdvcmRzLCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gcG9zdEluZm9MaXN0O1xuICAgIH07XG59IiwiaW1wb3J0IEZpbGVVdGlsIGZyb20gXCIuLi8uLi91dGlsL2ZpbGVVdGlsXCI7XG5pbXBvcnQgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcbmRvdGVudi5jb25maWcoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU2l0ZW1hcEJ1aWxkZXJcbntcbiAgICBwcml2YXRlIGxpbmVzID0gW2A8L3VybHNldD5gXTtcblxuICAgIGFkZEVudHJ5KHJlbGF0aXZlVVJMOiBzdHJpbmcsIGxhc3Rtb2Q6IHN0cmluZyk6IHZvaWRcbiAgICB7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPC91cmw+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgICA8bGFzdG1vZD4ke2xhc3Rtb2R9PC9sYXN0bW9kPmApO1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYCAgPGxvYz4ke3Byb2Nlc3MuZW52LlVSTF9TVEFUSUN9LyR7cmVsYXRpdmVVUkx9PC9sb2M+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPHVybD5gKTtcbiAgICB9XG5cbiAgICBhc3luYyBidWlsZCgpOiBQcm9taXNlPHZvaWQ+XG4gICAge1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2goYDx1cmxzZXQgeG1sbnM9XCJodHRwOi8vd3d3LnNpdGVtYXBzLm9yZy9zY2hlbWFzL3NpdGVtYXAvMC45XCI+YCk7XG4gICAgICAgIHRoaXMubGluZXMucHVzaChgPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+YCk7XG4gICAgICAgIHRoaXMubGluZXMucmV2ZXJzZSgpO1xuICAgICAgICBhd2FpdCBGaWxlVXRpbC53cml0ZShgc2l0ZW1hcC54bWxgLCB0aGlzLmxpbmVzLmpvaW4oXCJcXG5cIikpO1xuICAgIH1cbn0iLCJpbXBvcnQgRmlsZVV0aWwgZnJvbSBcIi4uLy4uL3V0aWwvZmlsZVV0aWxcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuZG90ZW52LmNvbmZpZygpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXh0RmlsZUJ1aWxkZXJcbntcbiAgICBwcml2YXRlIGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgYWRkTGluZShsaW5lOiBzdHJpbmcpOiB2b2lkXG4gICAge1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2gobGluZSk7XG4gICAgfVxuXG4gICAgZ2V0VGV4dCgpOiBzdHJpbmdcbiAgICB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfVxuXG4gICAgYXN5bmMgYnVpbGQocmVsYXRpdmVGaWxlUGF0aDogc3RyaW5nLCByb290RGlyPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPlxuICAgIHtcbiAgICAgICAgaWYgKHJvb3REaXIgPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcm9vdERpciA9IHByb2Nlc3MuZW52LlNUQVRJQ19QQUdFX1JPT1RfRElSO1xuICAgICAgICBhd2FpdCBGaWxlVXRpbC53cml0ZShyZWxhdGl2ZUZpbGVQYXRoLCB0aGlzLmxpbmVzLmpvaW4oXCJcXG5cIiksIHJvb3REaXIpO1xuICAgIH1cbn0iLCJpbXBvcnQgR2FtZUVudHJ5IGZyb20gXCIuLi90eXBlcy9nYW1lRW50cnlcIlxuXG5leHBvcnQgY29uc3QgQXJjYWRlRGF0YToge1xuICAgIGdhbWVFbnRyaWVzOiBHYW1lRW50cnlbXVxufSA9IHtcbiAgICBnYW1lRW50cmllczogW1xuICAgICAgICB7XG4gICAgICAgICAgICBkaXJOYW1lOiBcIkFydFJhaWRlclwiLFxuICAgICAgICAgICAgdGl0bGU6IFwiQXJ0UmFpZGVyXCIsXG4gICAgICAgICAgICBwbGF5TGlua0ltYWdlUGF0aE92ZXJyaWRlOiBcImJhZGdlX29uZXN0b3JlLnBuZ1wiLFxuICAgICAgICAgICAgcGxheUxpbmtVUkw6IFwiaHR0cHM6Ly9vbmVzdG8ucmUvMDAwMTAwMDM4M1wiLFxuICAgICAgICAgICAgdmlkZW9UYWc6IGA8aWZyYW1lIHdpZHRoPVwiNTYwXCIgaGVpZ2h0PVwiMzE1XCIgc3JjPVwiaHR0cHM6Ly93d3cueW91dHViZS5jb20vZW1iZWQvUnVMZ09Kck50S0E/c2k9VHNfWXVfamRwQjFxbU5pVFwiIHRpdGxlPVwiWW91VHViZSB2aWRlbyBwbGF5ZXJcIiBmcmFtZWJvcmRlcj1cIjBcIiBhbGxvdz1cImFjY2VsZXJvbWV0ZXI7IGF1dG9wbGF5OyBjbGlwYm9hcmQtd3JpdGU7IGVuY3J5cHRlZC1tZWRpYTsgZ3lyb3Njb3BlOyBwaWN0dXJlLWluLXBpY3R1cmU7IHdlYi1zaGFyZVwiIHJlZmVycmVycG9saWN5PVwic3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpblwiIGFsbG93ZnVsbHNjcmVlbj48L2lmcmFtZT5gLFxuICAgICAgICAgICAgbGFzdG1vZDogXCIyMDI1LTA0LTE1XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGRpck5hbWU6IFwiV2F0ZXItdnMtRmlyZVwiLFxuICAgICAgICAgICAgdGl0bGU6IFwiV2F0ZXIgdnMgRmlyZVwiLFxuICAgICAgICAgICAgcGxheUxpbmtVUkw6IFwiaHR0cHM6Ly93d3cuZ2FtZWFydGVyLmNvbS9nYW1lL3dhdGVyLXZzLWZpcmVcIixcbiAgICAgICAgICAgIHZpZGVvVGFnOiBgPGlmcmFtZSB3aWR0aD1cIjU2MFwiIGhlaWdodD1cIjMxNVwiIHNyYz1cImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkLzZEZUFfbThJcTRNP3NpPWhDMXV6a0V0QldwWWNNOHpcIiB0aXRsZT1cIllvdVR1YmUgdmlkZW8gcGxheWVyXCIgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3c9XCJhY2NlbGVyb21ldGVyOyBhdXRvcGxheTsgY2xpcGJvYXJkLXdyaXRlOyBlbmNyeXB0ZWQtbWVkaWE7IGd5cm9zY29wZTsgcGljdHVyZS1pbi1waWN0dXJlOyB3ZWItc2hhcmVcIiBhbGxvd2Z1bGxzY3JlZW4+PC9pZnJhbWU+YCxcbiAgICAgICAgICAgIGxhc3Rtb2Q6IFwiMjAyMy0wOS0xMFwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBkaXJOYW1lOiBcIkh1bnRMYW5kXCIsXG4gICAgICAgICAgICB0aXRsZTogXCJIdW50TGFuZFwiLFxuICAgICAgICAgICAgcGxheUxpbmtVUkw6IFwiaHR0cHM6Ly93d3cuZ2FtZWFydGVyLmNvbS9nYW1lL2h1bnRsYW5kXCIsXG4gICAgICAgICAgICB2aWRlb1RhZzogYDxpZnJhbWUgd2lkdGg9XCI1NjBcIiBoZWlnaHQ9XCIzMTVcIiBzcmM9XCJodHRwczovL3d3dy55b3V0dWJlLmNvbS9lbWJlZC8zZFJnNnZ2b1BxYz9zaT1GbG5LVnl6UXEwXzU1c0wyXCIgdGl0bGU9XCJZb3VUdWJlIHZpZGVvIHBsYXllclwiIGZyYW1lYm9yZGVyPVwiMFwiIGFsbG93PVwiYWNjZWxlcm9tZXRlcjsgYXV0b3BsYXk7IGNsaXBib2FyZC13cml0ZTsgZW5jcnlwdGVkLW1lZGlhOyBneXJvc2NvcGU7IHBpY3R1cmUtaW4tcGljdHVyZTsgd2ViLXNoYXJlXCIgYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPmAsXG4gICAgICAgICAgICBsYXN0bW9kOiBcIjIwMjMtMDktMTBcIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgZGlyTmFtZTogXCJQb2xpY2VDaGFzZVwiLFxuICAgICAgICAgICAgdGl0bGU6IFwiUG9saWNlIENoYXNlXCIsXG4gICAgICAgICAgICBwbGF5TGlua1VSTDogXCJodHRwczovL3d3dy5nYW1lYXJ0ZXIuY29tL2dhbWUvcG9saWNlY2hhc2VcIixcbiAgICAgICAgICAgIHZpZGVvVGFnOiBgPGlmcmFtZSB3aWR0aD1cIjU2MFwiIGhlaWdodD1cIjMxNVwiIHNyYz1cImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL2tBQmcwajJtWnFRP3NpPTMtSlVaUW5oM29tVlhTSmRcIiB0aXRsZT1cIllvdVR1YmUgdmlkZW8gcGxheWVyXCIgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3c9XCJhY2NlbGVyb21ldGVyOyBhdXRvcGxheTsgY2xpcGJvYXJkLXdyaXRlOyBlbmNyeXB0ZWQtbWVkaWE7IGd5cm9zY29wZTsgcGljdHVyZS1pbi1waWN0dXJlOyB3ZWItc2hhcmVcIiBhbGxvd2Z1bGxzY3JlZW4+PC9pZnJhbWU+YCxcbiAgICAgICAgICAgIGxhc3Rtb2Q6IFwiMjAyMy0wOS0xMFwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBkaXJOYW1lOiBcIlNwYWNlVG93blwiLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3BhY2VUb3duXCIsXG4gICAgICAgICAgICBwbGF5TGlua1VSTDogXCJodHRwczovL3d3dy5nYW1lYXJ0ZXIuY29tL2dhbWUvc3BhY2V0b3duXCIsXG4gICAgICAgICAgICB2aWRlb1RhZzogYDxpZnJhbWUgd2lkdGg9XCI1NjBcIiBoZWlnaHQ9XCIzMTVcIiBzcmM9XCJodHRwczovL3d3dy55b3V0dWJlLmNvbS9lbWJlZC9Ob2lRekVLSk0tQT9zaT1vOHZUTnFXMWt4Q0o0TW5XXCIgdGl0bGU9XCJZb3VUdWJlIHZpZGVvIHBsYXllclwiIGZyYW1lYm9yZGVyPVwiMFwiIGFsbG93PVwiYWNjZWxlcm9tZXRlcjsgYXV0b3BsYXk7IGNsaXBib2FyZC13cml0ZTsgZW5jcnlwdGVkLW1lZGlhOyBneXJvc2NvcGU7IHBpY3R1cmUtaW4tcGljdHVyZTsgd2ViLXNoYXJlXCIgYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPmAsXG4gICAgICAgICAgICBsYXN0bW9kOiBcIjIwMjMtMDktMjBcIixcbiAgICAgICAgfSxcbiAgICBdXG59OyIsImltcG9ydCBQb3N0RW50cnkgZnJvbSBcIi4uL3R5cGVzL3Bvc3RFbnRyeVwiXG5cbmV4cG9ydCBjb25zdCBMaWJyYXJ5RGF0YToge1xuICAgIGVudHJpZXNCeUNhdGVnb3J5OiB7IFtjYXRlZ29yeTogc3RyaW5nXTogUG9zdEVudHJ5W10gfVxufSA9IHtcbiAgICBlbnRyaWVzQnlDYXRlZ29yeSA6IHtcbiAgICAgICAgXCJOb25maWN0aW9uXCI6IFtcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJtZXRhcGh5c2ljc1wiLCB0aXRsZTogXCLtmJXsnbTsg4HtlZkgKDIwMTMgLSAyMDE0KVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJnYW1lLWFuYWx5c2lzXCIsIHRpdGxlOiBcIuqyjOyehOu2hOyEnSAoMjAxOSlcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiZXNzYXlzXCIsIHRpdGxlOiBcIk1pc2NlbGxhbmVvdXMgV3JpdGluZ3MgKDIwMjIgLSAyMDI0KVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJibG9ja2NoYWluc1wiLCB0aXRsZTogXCJPbiBMZWdpdGltYWN5IG9mIEJsb2NrY2hhaW5zICgyMDIyKVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJzb2Z0d2FyZS1kZXZlbG9wbWVudFwiLCB0aXRsZTogXCJTb2Z0d2FyZSBEZXZlbG9wbWVudCAoMjAyMiAtIDIwMjQpXCJ9LFxuICAgICAgICAgICAgeyBkaXJOYW1lOiBcImdhbWUtZGVzaWduXCIsIHRpdGxlOiBcIlVuaXZlcnNhbCBMYXdzIG9mIEdhbWUgRGVzaWduICgyMDIzKVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJyZWFsaXR5XCIsIHRpdGxlOiBcIlRoZSBPcmlnaW4gb2YgUmVhbGl0eSAoMjAyMylcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiYnJpZGdlLXRvLW1hdGhcIiwgdGl0bGU6IFwiQSBMYXltYW4ncyBCcmlkZ2UgdG8gTWF0aGVtYXRpY3MgKDIwMjQpXCJ9LFxuICAgICAgICAgICAgeyBkaXJOYW1lOiBcInJlYWQtcmVjXCIsIHRpdGxlOiBcIlJlY29tbWVuZGVkIFJlYWRpbmdzICgyMDI0KVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJtb3JzZWxzXCIsIHRpdGxlOiBcIk1vcnNlbHMgb2YgVGhvdWdodCAoMjAyNClcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiY29uY2VwdHMtb2YtcGxhblwiLCB0aXRsZTogXCJDb25jZXB0cyBvZiBhIFBsYW4gKDIwMjUpXCJ9LFxuICAgICAgICBdLFxuICAgICAgICBcIkZpY3Rpb25cIjogW1xuICAgICAgICAgICAgeyBkaXJOYW1lOiBcIm5vdmVsc1wiLCB0aXRsZTogXCLri6jtjrjshozshKQgKDIwMTIgLSAyMDEzKVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJhbGllbi1qb2ItaW50ZXJ2aWV3XCIsIHRpdGxlOiBcIkFsaWVuIEpvYiBJbnRlcnZpZXcgKDIwMjIpXCJ9LFxuICAgICAgICAgICAgeyBkaXJOYW1lOiBcImluZmluaXRlLXRyZWFzdXJlc1wiLCB0aXRsZTogXCJUaGUgSXNsYW5kIG9mIEluZmluaXRlIFRyZWFzdXJlcyAoMjAyMilcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiaW5mc29jXCIsIHRpdGxlOiBcIkluZmx1ZW50aWFsIFNvY2lhbCBQb3N0cyAoMjAyMylcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiZ2FtZWRldi1qb3VybmV5XCIsIHRpdGxlOiBcIkEgR2FtZSBEZXZlbG9wZXIncyBKb3VybmV5ICgyMDIzKVwifSxcbiAgICAgICAgICAgIHsgZGlyTmFtZTogXCJzYW5kd2ljaFwiLCB0aXRsZTogXCJTYW5kd2ljaCBFbmdpbmVlcmluZyAoMjAyNSlcIn0sXG4gICAgICAgIF0sXG4gICAgICAgIFwiQXJ0c1wiOiBbXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiaWxsdXN0cmF0aW9uc1wiLCB0aXRsZTogXCJJbGx1c3RyYXRpb25zICgyMDA5IC0gMjAxNClcIn0sXG4gICAgICAgICAgICB7IGRpck5hbWU6IFwiY2FydG9vbnNcIiwgdGl0bGU6IFwiQ2FydG9vbnMgKDIwMTEgLSAyMDE1KVwifSxcbiAgICAgICAgXSxcbiAgICB9XG59OyIsImltcG9ydCBGaWxlVXRpbCBmcm9tIFwiLi4vdXRpbC9maWxlVXRpbFwiO1xuaW1wb3J0IEVKU1V0aWwgZnJvbSBcIi4uL3V0aWwvZWpzVXRpbFwiO1xuaW1wb3J0IFNpdGVtYXBCdWlsZGVyIGZyb20gXCIuL2J1aWxkZXIvc2l0ZW1hcEJ1aWxkZXJcIjtcbmltcG9ydCBBdG9tRmVlZEJ1aWxkZXIgZnJvbSBcIi4vYnVpbGRlci9hdG9tRmVlZEJ1aWxkZXJcIjtcbmltcG9ydCBBcmNhZGVQYWdlQnVpbGRlciBmcm9tIFwiLi9idWlsZGVyL3BhZ2UvYXJjYWRlUGFnZUJ1aWxkZXJcIjtcbmltcG9ydCBMaWJyYXJ5UGFnZUJ1aWxkZXIgZnJvbSBcIi4vYnVpbGRlci9wYWdlL2xpYnJhcnlQYWdlQnVpbGRlclwiO1xuaW1wb3J0IFRleHRGaWxlQnVpbGRlciBmcm9tIFwiLi9idWlsZGVyL3RleHRGaWxlQnVpbGRlclwiO1xuaW1wb3J0IEVtYmVkZGVkU2NyaXB0QnVpbGRlciBmcm9tIFwiLi9idWlsZGVyL2VtYmVkZGVkU2NyaXB0QnVpbGRlclwiO1xuaW1wb3J0IHN0eWxlRGljdGlvbmFyeSBmcm9tIFwiLi9zdHlsZS9zdHlsZURpY3Rpb25hcnlcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IEVycm9yUGFnZUJ1aWxkZXIgZnJvbSBcIi4vYnVpbGRlci9wYWdlL2Vycm9yUGFnZUJ1aWxkZXJcIjtcbmRvdGVudi5jb25maWcoKTtcblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gU1NHKCk6IFByb21pc2U8dm9pZD5cbntcbiAgICBjb25zb2xlLmxvZyhcIlNTRyBTVEFSVFwiKTtcblxuICAgIC8vIEdlbmVyYXRlIHBhZ2VzXG5cbiAgICBjb25zdCBzaXRlbWFwQiA9IG5ldyBTaXRlbWFwQnVpbGRlcigpO1xuICAgIGNvbnN0IGF0b21GZWVkQiA9IG5ldyBBdG9tRmVlZEJ1aWxkZXIoKTtcblxuICAgIGxldCB0YiA9IG5ldyBUZXh0RmlsZUJ1aWxkZXIoKTtcbiAgICB0Yi5hZGRMaW5lKGF3YWl0IEVKU1V0aWwuY3JlYXRlU3RhdGljSFRNTEZyb21FSlMoXCJwYWdlL3N0YXRpYy9pbmRleC5lanNcIiwge30pKTtcbiAgICBhd2FpdCB0Yi5idWlsZChcImluZGV4Lmh0bWxcIik7XG5cbiAgICB0YiA9IG5ldyBUZXh0RmlsZUJ1aWxkZXIoKTtcbiAgICB0Yi5hZGRMaW5lKGF3YWl0IEVKU1V0aWwuY3JlYXRlU3RhdGljSFRNTEZyb21FSlMoXCJwYWdlL3N0YXRpYy9wb3J0Zm9saW8uZWpzXCIsIHt9KSk7XG4gICAgYXdhaXQgdGIuYnVpbGQoXCJwb3J0Zm9saW8uaHRtbFwiKTtcblxuICAgIHRiID0gbmV3IFRleHRGaWxlQnVpbGRlcigpO1xuICAgIHRiLmFkZExpbmUoYXdhaXQgRUpTVXRpbC5jcmVhdGVTdGF0aWNIVE1MRnJvbUVKUyhcInBhZ2Uvc3RhdGljL3BvcnRmb2xpb19taW5pbWFsLmVqc1wiLCB7fSkpO1xuICAgIGF3YWl0IHRiLmJ1aWxkKFwicG9ydGZvbGlvX21pbmltYWwuaHRtbFwiKTtcblxuICAgIHRiID0gbmV3IFRleHRGaWxlQnVpbGRlcigpO1xuICAgIHRiLmFkZExpbmUoYXdhaXQgRUpTVXRpbC5jcmVhdGVTdGF0aWNIVE1MRnJvbUVKUyhcInBhZ2Uvc3RhdGljL3ByaXZhY3lQb2xpY3kuZWpzXCIsIHt9KSk7XG4gICAgYXdhaXQgdGIuYnVpbGQoXCJwcml2YWN5LXBvbGljeS5odG1sXCIpO1xuXG4gICAgdGIgPSBuZXcgVGV4dEZpbGVCdWlsZGVyKCk7XG4gICAgdGIuYWRkTGluZShhd2FpdCBFSlNVdGlsLmNyZWF0ZVN0YXRpY0hUTUxGcm9tRUpTKFwicGFnZS9zdGF0aWMvdGVybXNPZlNlcnZpY2UuZWpzXCIsIHt9KSk7XG4gICAgYXdhaXQgdGIuYnVpbGQoXCJ0ZXJtcy1vZi1zZXJ2aWNlLmh0bWxcIik7XG5cbiAgICBhd2FpdCBuZXcgQXJjYWRlUGFnZUJ1aWxkZXIoc2l0ZW1hcEIsIGF0b21GZWVkQikuYnVpbGQoKTtcbiAgICBhd2FpdCBuZXcgTGlicmFyeVBhZ2VCdWlsZGVyKHNpdGVtYXBCLCBhdG9tRmVlZEIpLmJ1aWxkKCk7XG4gICAgYXdhaXQgbmV3IEVycm9yUGFnZUJ1aWxkZXIoKS5idWlsZCgpO1xuXG4gICAgYXdhaXQgc2l0ZW1hcEIuYnVpbGQoKTtcbiAgICBhd2FpdCBhdG9tRmVlZEIuYnVpbGQoKTtcblxuICAgIC8vIEdlbmVyYXRlIENTU1xuICAgIGF3YWl0IEZpbGVVdGlsLndyaXRlKFwic3R5bGUuY3NzXCIsIHN0eWxlRGljdGlvbmFyeSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBlbWJlZGRlZCBzY3JpcHRzXG4gICAgYXdhaXQgbmV3IEVtYmVkZGVkU2NyaXB0QnVpbGRlcigpLmJ1aWxkKCk7XG5cbiAgICBjb25zb2xlLmxvZyhcIlNTRyBFTkRcIik7XG59IiwiLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEdsb2JhbCBQYXJhbWV0ZXJzXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBleHRyYURhcmtDb2xvciA9IFwiIzEwMTAxMFwiO1xuY29uc3QgZGFya0NvbG9yID0gXCIjMzAzMDMwXCI7XG5jb25zdCBkaW1Db2xvciA9IFwiIzcwNzA3MFwiO1xuY29uc3QgbWVkaXVtQ29sb3IgPSBcIiNhMGEwYTBcIjtcbmNvbnN0IGxpZ2h0Q29sb3IgPSBcIiNjMGMwYzBcIjtcbmNvbnN0IGxpZ2h0WWVsbG93Q29sb3IgPSBcIiNkMGMwOTBcIjtcbmNvbnN0IGxpZ2h0R3JlZW5Db2xvciA9IFwiIzcwYzA2MFwiO1xuY29uc3QgbWVkaXVtWWVsbG93Q29sb3IgPSBcIiNiMGEwNzBcIjtcblxuY29uc3QgZGVmYXVsdFRleHRBbGlnbiA9IFwibGVmdFwiO1xuY29uc3QgZnVsbHNjcmVlbkJhclRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG5cbmNvbnN0IGZ1bGxzY3JlZW5MZWZ0QmFyV2lkdGhQZXJjZW50ID0gMTQ7XG5jb25zdCBmdWxsc2NyZWVuVG9wQmFySGVpZ2h0UGVyY2VudCA9IDEyO1xuY29uc3QgZnVsbHNjcmVlbkxlZnRCYXJMb2dvQXJlYUhlaWdodFBlcmNlbnQgPSAxNDtcbmNvbnN0IGZ1bGxzY3JlZW5Ub3BCYXJMb2dvQXJlYUhlaWdodFBlcmNlbnQgPSA2NTtcbmNvbnN0IGZ1bGxzY3JlZW5QYW5lbFdpZHRoUGFkZGluZ1BlcmNlbnQgPSAyLjU7XG5cbmNvbnN0IHNjcm9sbGJhcl90aGlja25lc3MgPSBcIjE3cHhcIjtcbmNvbnN0IHNjcm9sbGJhcl9ib3JkZXJfcmFkaXVzID0gXCI4cHhcIjtcbmNvbnN0IHNjcm9sbGJhcl9ib3JkZXJfdGhpY2tuZXNzID0gXCI0cHhcIjtcblxuY29uc3Qgc3BhY2UgPSB7XG5cdHVuaXQ6IHtcblx0XHRsYW5kc2NhcGU6IHtcblx0XHRcdHZlcnRpY2FsOiAwLjYsXG5cdFx0XHRob3Jpem9udGFsOiAxLFxuXHRcdH0sXG5cdFx0cG9ydHJhaXQ6IHtcblx0XHRcdHZlcnRpY2FsOiAxLFxuXHRcdFx0aG9yaXpvbnRhbDogMi41LFxuXHRcdH0sXG5cdH0sXG59O1xuXG5jb25zdCByZWd1bGFyX2ZvbnRfd2VpZ2h0ID0gNDAwO1xuY29uc3QgYm9sZF9mb250X3dlaWdodCA9IDgwMDtcbmNvbnN0IGZvbnRTY2FsZUZhY3Rvcl92bWF4ID0gMC43O1xuY29uc3QgZm9udFNjYWxlRmFjdG9yX3B4ID0gMS4wO1xuY29uc3QgZm9udF92bWF4X21pbiA9IDIuNjtcbmNvbnN0IGZvbnRfcHhfbWluID0gMTY7XG5jb25zdCBmb250U2NhbGVJbmMgPSAxLjI7XG5jb25zdCBmb250U2NhbGVJbmMyID0gZm9udFNjYWxlSW5jKmZvbnRTY2FsZUluYztcbmNvbnN0IGZvbnRTY2FsZUluYzMgPSBmb250U2NhbGVJbmMqZm9udFNjYWxlSW5jKmZvbnRTY2FsZUluYztcbmNvbnN0IGZvbnRTY2FsZUluYzQgPSBmb250U2NhbGVJbmMqZm9udFNjYWxlSW5jKmZvbnRTY2FsZUluYypmb250U2NhbGVJbmM7XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBGdW5jdGlvbnNcbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIEFyZWFzXG5cbmNvbnN0IGFic29sdXRlQXJlYSA9IChsZWZ0UGVyY2VudDogbnVtYmVyLCByaWdodFBlcmNlbnQ6IG51bWJlciwgdG9wUGVyY2VudDogbnVtYmVyLCBib3R0b21QZXJjZW50OiBudW1iZXIsXG5cdHdpZHRoUGVyY2VudDogbnVtYmVyLCBoZWlnaHRQZXJjZW50OiBudW1iZXIpOiBzdHJpbmcgPT5cbmBwb3NpdGlvbjogYWJzb2x1dGU7XG5cXHRkaXNwbGF5OiBibG9jaztcblxcdGxlZnQ6ICR7bGVmdFBlcmNlbnR9JTtcblxcdHJpZ2h0OiAke3JpZ2h0UGVyY2VudH0lO1xuXFx0dG9wOiAke3RvcFBlcmNlbnR9JTtcblxcdGJvdHRvbTogJHtib3R0b21QZXJjZW50fSU7XG5cXHR3aWR0aDogJHt3aWR0aFBlcmNlbnR9JTtcblxcdGhlaWdodDogJHtoZWlnaHRQZXJjZW50fSU7YDtcblxuY29uc3QgcmVsYXRpdmVBcmVhID0gKG5leHRsaW5lOiBib29sZWFuLCBtYXhXaWR0aDogc3RyaW5nKTogc3RyaW5nID0+XG5gcG9zaXRpb246IHJlbGF0aXZlO1xuXFx0ZGlzcGxheTogJHtuZXh0bGluZSA/IFwiYmxvY2tcIiA6IFwiaW5saW5lLWJsb2NrXCJ9O1xuXFx0bWF4LXdpZHRoOiAke21heFdpZHRofTtgO1xuXG5jb25zdCByZWxhdGl2ZUFuZEZsZXhpYmxlQXJlYSA9IChuZXh0bGluZTogYm9vbGVhbik6IHN0cmluZyA9PlxuYHBvc2l0aW9uOiByZWxhdGl2ZTtcblxcdGRpc3BsYXk6ICR7bmV4dGxpbmUgPyBcImJsb2NrXCIgOiBcImlubGluZS1ibG9ja1wifTtcblxcdG1heC13aWR0aDogbm9uZTtcblxcdHdpZHRoOiBmaXQtY29udGVudDtcblxcdGJsb2NrLXNpemU6IGZpdC1jb250ZW50O2A7XG5cbmNvbnN0IHJlbGF0aXZlRml4ZWRTaXplQXJlYSA9IChuZXh0bGluZTogYm9vbGVhbiwgd2lkdGg6IHN0cmluZywgaGVpZ2h0OiBzdHJpbmcpOiBzdHJpbmcgPT5cbmBwb3NpdGlvbjogcmVsYXRpdmU7XG5cXHRkaXNwbGF5OiAke25leHRsaW5lID8gXCJibG9ja1wiIDogXCJpbmxpbmUtYmxvY2tcIn07XG5cXHR3aWR0aDogJHt3aWR0aH07XG5cXHRoZWlnaHQ6ICR7aGVpZ2h0fTtgO1xuXG4vLyBTcGFjaW5nXG5cbmNvbnN0IHNwYWNpbmcgPSAobGFuZHNjYXBlOiBib29sZWFuLCB2ZXJ0aWNhbFNjYWxlOiBudW1iZXIsIGhvcml6b250YWxTY2FsZTogbnVtYmVyLFxuXHRzdXBwcmVzc01hcmdpbjogYm9vbGVhbiA9IGZhbHNlLCBzdXBwcmVzc1BhZGRpbmc6IGJvb2xlYW4gPSBmYWxzZSk6IHN0cmluZyA9Plxue1xuXHRjb25zdCB1bml0ID0gc3BhY2UudW5pdFtsYW5kc2NhcGUgPyBcImxhbmRzY2FwZVwiIDogXCJwb3J0cmFpdFwiXTtcblx0Y29uc3QgdmVydGljYWxTaXplID0gKHVuaXQudmVydGljYWwgKiB2ZXJ0aWNhbFNjYWxlKS50b0ZpeGVkKDIpO1xuXHRjb25zdCBob3Jpem9udGFsU2l6ZSA9ICh1bml0Lmhvcml6b250YWwgKiBob3Jpem9udGFsU2NhbGUpLnRvRml4ZWQoMik7XG5cdGNvbnN0IHZlcnRpY2FsUGFkZGluZyA9IHN1cHByZXNzUGFkZGluZyA/IFwiMFwiIDogYCR7dmVydGljYWxTaXplfSVgO1xuXHRjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IHN1cHByZXNzUGFkZGluZyA/IFwiMFwiIDogYCR7aG9yaXpvbnRhbFNpemV9JWA7XG5cdGNvbnN0IHZlcnRpY2FsTWFyZ2luID0gc3VwcHJlc3NNYXJnaW4gPyBcIjBcIiA6IGAke3ZlcnRpY2FsU2l6ZX0lYDtcblx0Y29uc3QgaG9yaXpvbnRhbE1hcmdpbiA9IHN1cHByZXNzTWFyZ2luID8gXCIwXCIgOiBgJHtob3Jpem9udGFsU2l6ZX0lYDtcbnJldHVybiBgcGFkZGluZzogJHt2ZXJ0aWNhbFBhZGRpbmd9ICR7aG9yaXpvbnRhbFBhZGRpbmd9ICR7dmVydGljYWxQYWRkaW5nfSAke2hvcml6b250YWxQYWRkaW5nfTtcblxcdG1hcmdpbjogJHt2ZXJ0aWNhbE1hcmdpbn0gJHtob3Jpem9udGFsTWFyZ2lufSAke3ZlcnRpY2FsTWFyZ2lufSAwO2A7XG59O1xuXG4vLyBGb250XG5cbmNvbnN0IGZvbnQgPSAoZm9udFNpemU6IHN0cmluZywgaXNJdGFsaWM6IGJvb2xlYW4sIGZvbnRXZWlnaHQ6IG51bWJlcik6IHN0cmluZyA9PlxuYGZvbnQtc2l6ZTogJHtmb250U2l6ZX07XG5cXHRmb250LWZhbWlseTogXCJMdWNpZGEgQ29uc29sZVwiLCBcIkx1Y2lkYSBTYW5zIFR5cGV3cml0ZXJcIiwgXCJNb25hY29cIiwgQ29uc29sYXMsIG1vbm9zcGFjZTtcblxcdGZvbnQtc3R5bGU6ICR7aXNJdGFsaWMgPyBcIml0YWxpY1wiIDogXCJub3JtYWxcIn07XG5cXHRmb250LXdlaWdodDogJHtmb250V2VpZ2h0fTtgO1xuXG4vLyBGcmFtZXNcblxuY29uc3Qgc2ltcGxlRnJhbWUgPSAoYmFja2dyb3VuZENvbG9yOiBzdHJpbmcsIGZvcmVncm91bmRDb2xvcjogc3RyaW5nLCBvcGFjaXR5OiBudW1iZXIgPSAxKTogc3RyaW5nID0+XG5gYmFja2dyb3VuZC1jb2xvcjogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuXFx0Y29sb3I6ICR7Zm9yZWdyb3VuZENvbG9yfTskeyhvcGFjaXR5IDwgMSkgPyBgXFxuXFx0b3BhY2l0eTogJHtvcGFjaXR5fTtgIDogXCJcIn1gO1xuXG5jb25zdCByb3VuZGVkRnJhbWUgPSAoYmFja2dyb3VuZENvbG9yOiBzdHJpbmcsIGZvcmVncm91bmRDb2xvcjogc3RyaW5nLCBvcGFjaXR5OiBudW1iZXIgPSAxKTogc3RyaW5nID0+XG5zaW1wbGVGcmFtZShiYWNrZ3JvdW5kQ29sb3IsIGZvcmVncm91bmRDb2xvciwgb3BhY2l0eSkgKyBcIlxcblwiICtcbmBcXHRib3JkZXItcmFkaXVzOiAydm1pbjtgO1xuXG5jb25zdCBlbGV2YXRlZEZyYW1lID0gKGJhY2tncm91bmRDb2xvcjogc3RyaW5nLCBmb3JlZ3JvdW5kQ29sb3I6IHN0cmluZywgYm9yZGVyQ29sb3I6IHN0cmluZyxcblx0Ym9yZGVyVGhpY2tuZXNzOiBzdHJpbmcgPSBcIjEuMjVcIiwgb3BhY2l0eTogbnVtYmVyID0gMSk6IHN0cmluZyA9Plxucm91bmRlZEZyYW1lKGJhY2tncm91bmRDb2xvciwgZm9yZWdyb3VuZENvbG9yLCBvcGFjaXR5KSArIFwiXFxuXCIgK1xuYFxcdGJvcmRlci1ib3R0b206ICR7Ym9yZGVyVGhpY2tuZXNzfXZtaW4gJHtib3JkZXJDb2xvcn0gc29saWQ7YCArIFwiXFxuXCIgK1xuYFxcdGJvcmRlci1yaWdodDogJHtib3JkZXJUaGlja25lc3N9dm1pbiAke2JvcmRlckNvbG9yfSBzb2xpZDtgO1xuXG5jb25zdCBvdXRsaW5lZEZyYW1lID0gKGJhY2tncm91bmRDb2xvcjogc3RyaW5nLCBmb3JlZ3JvdW5kQ29sb3I6IHN0cmluZywgYm9yZGVyQ29sb3I6IHN0cmluZyxcblx0Ym9yZGVyVGhpY2tuZXNzOiBzdHJpbmcgPSBcIjEuMjVcIiwgb3BhY2l0eTogbnVtYmVyID0gMSk6IHN0cmluZyA9Plxucm91bmRlZEZyYW1lKGJhY2tncm91bmRDb2xvciwgZm9yZWdyb3VuZENvbG9yLCBvcGFjaXR5KSArIFwiXFxuXCIgK1xuYFxcdGJvcmRlcjogJHtib3JkZXJUaGlja25lc3N9dm1pbiAke2JvcmRlckNvbG9yfSBzb2xpZDtgO1xuXG5jb25zdCB1bmRlcmxpbmVkRnJhbWUgPSAoYmFja2dyb3VuZENvbG9yOiBzdHJpbmcsIGZvcmVncm91bmRDb2xvcjogc3RyaW5nLCB1bmRlcmxpbmVDb2xvcjogc3RyaW5nLFxuXHR1bmRlcmxpbmVUaGlja25lc3M6IHN0cmluZyA9IFwiMS4yNVwiLCBvcGFjaXR5OiBudW1iZXIgPSAxKTogc3RyaW5nID0+XG5zaW1wbGVGcmFtZShiYWNrZ3JvdW5kQ29sb3IsIGZvcmVncm91bmRDb2xvciwgb3BhY2l0eSkgKyBcIlxcblwiICtcbmBcXHRib3JkZXItYm90dG9tOiAke3VuZGVybGluZVRoaWNrbmVzc312bWluICR7dW5kZXJsaW5lQ29sb3J9IHNvbGlkO2A7XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBFbGVtZW50YXJ5IFN0eWxlc1xuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgZnVsbHNjcmVlbl93aG9sZV9hcmVhID0gYWJzb2x1dGVBcmVhKFxuXHQwLCAwLCAwLCAwLFxuXHQxMDAsIDEwMCk7XG5cbmNvbnN0IGZ1bGxzY3JlZW5fbGVmdF9iYXJfYXJlYSA9IGFic29sdXRlQXJlYShcblx0MCwgMTAwIC0gZnVsbHNjcmVlbkxlZnRCYXJXaWR0aFBlcmNlbnQsIDAsIDAsXG5cdGZ1bGxzY3JlZW5MZWZ0QmFyV2lkdGhQZXJjZW50LCAxMDApO1xuXG5jb25zdCBmdWxsc2NyZWVuX3RvcF9iYXJfYXJlYSA9IGFic29sdXRlQXJlYShcblx0MCwgMCwgMCwgMTAwIC0gZnVsbHNjcmVlblRvcEJhckhlaWdodFBlcmNlbnQsXG5cdDEwMCwgZnVsbHNjcmVlblRvcEJhckhlaWdodFBlcmNlbnQpO1xuXG5jb25zdCBmdWxsc2NyZWVuX3JpZ2h0X3BhbmVsX2FyZWEgPSBhYnNvbHV0ZUFyZWEoXG5cdGZ1bGxzY3JlZW5MZWZ0QmFyV2lkdGhQZXJjZW50LCAyKmZ1bGxzY3JlZW5QYW5lbFdpZHRoUGFkZGluZ1BlcmNlbnQsIDAsIDAsXG5cdDEwMCAtIChmdWxsc2NyZWVuTGVmdEJhcldpZHRoUGVyY2VudCArIDIqZnVsbHNjcmVlblBhbmVsV2lkdGhQYWRkaW5nUGVyY2VudCksIDEwMCk7XG5cbmNvbnN0IGZ1bGxzY3JlZW5fYm90dG9tX3BhbmVsX2FyZWEgPSBhYnNvbHV0ZUFyZWEoXG5cdDAsIGZ1bGxzY3JlZW5QYW5lbFdpZHRoUGFkZGluZ1BlcmNlbnQsIGZ1bGxzY3JlZW5Ub3BCYXJIZWlnaHRQZXJjZW50LCAwLFxuXHQxMDAgLSAyKmZ1bGxzY3JlZW5QYW5lbFdpZHRoUGFkZGluZ1BlcmNlbnQsIDEwMCAtIGZ1bGxzY3JlZW5Ub3BCYXJIZWlnaHRQZXJjZW50KTtcblxuY29uc3QgZnVsbHNjcmVlbl9sZWZ0X2Jhcl9sb2dvX2FyZWEgPSBhYnNvbHV0ZUFyZWEoXG5cdDAsIDAsIDAsIDEwMCAtIGZ1bGxzY3JlZW5MZWZ0QmFyTG9nb0FyZWFIZWlnaHRQZXJjZW50LFxuXHQxMDAsIGZ1bGxzY3JlZW5MZWZ0QmFyTG9nb0FyZWFIZWlnaHRQZXJjZW50KTtcblxuY29uc3QgZnVsbHNjcmVlbl9sZWZ0X2Jhcl9tZW51X2FyZWEgPSBhYnNvbHV0ZUFyZWEoXG5cdDAsIDAsIGZ1bGxzY3JlZW5MZWZ0QmFyTG9nb0FyZWFIZWlnaHRQZXJjZW50LCAwLFxuXHQxMDAsIDgwKTtcblxuY29uc3QgZnVsbHNjcmVlbl90b3BfYmFyX2xvZ29fYXJlYSA9IGFic29sdXRlQXJlYShcblx0MCwgMCwgMCwgMTAwIC0gZnVsbHNjcmVlblRvcEJhckxvZ29BcmVhSGVpZ2h0UGVyY2VudCxcblx0MTAwLCBmdWxsc2NyZWVuVG9wQmFyTG9nb0FyZWFIZWlnaHRQZXJjZW50KTtcblxuY29uc3QgZnVsbHNjcmVlbl90b3BfYmFyX21lbnVfYXJlYSA9IGFic29sdXRlQXJlYShcblx0MCwgMCwgZnVsbHNjcmVlblRvcEJhckxvZ29BcmVhSGVpZ2h0UGVyY2VudCwgMCxcblx0MTAwLCAxMDAgLSBmdWxsc2NyZWVuVG9wQmFyTG9nb0FyZWFIZWlnaHRQZXJjZW50KTtcblxuY29uc3QgbGlzdF9zY3JvbGxfcGFuZWxfYXJlYSA9IChfPzogYW55KTogc3RyaW5nID0+IHJlbGF0aXZlRml4ZWRTaXplQXJlYSh0cnVlLCBgJHsoMTAwKS50b0ZpeGVkKDIpfSVgLCBgJHsoNzApLnRvRml4ZWQoMil9JWApO1xuXG5jb25zdCBnZXRHcmFjZVdpZHRoUGVyY2VudCA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBudW1iZXIgPT5cblx0MiAqIHNwYWNlLnVuaXRbbGFuZHNjYXBlID8gXCJsYW5kc2NhcGVcIiA6IFwicG9ydHJhaXRcIl0uaG9yaXpvbnRhbDtcblxuY29uc3QgZnVsbF9yb3dfYXJlYSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gcmVsYXRpdmVBcmVhKHRydWUsIGAkeygxMDApLnRvRml4ZWQoMil9JWApO1xuY29uc3QgbmVhcl9mdWxsX3Jvd19hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEodHJ1ZSwgYCR7KDk4KS50b0ZpeGVkKDIpfSVgKTtcbmNvbnN0IHR3b1RoaXJkc19yb3dfYXJlYSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gcmVsYXRpdmVBcmVhKHRydWUsIGAkeyg2NiAtIGdldEdyYWNlV2lkdGhQZXJjZW50KGxhbmRzY2FwZSkpLnRvRml4ZWQoMil9JWApO1xuY29uc3QgaGFsZl9yb3dfYXJlYSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gcmVsYXRpdmVBcmVhKHRydWUsIGAkeyg1MCAtIGdldEdyYWNlV2lkdGhQZXJjZW50KGxhbmRzY2FwZSkpLnRvRml4ZWQoMil9JWApO1xuY29uc3QgdGhpcmRfcm93X2FyZWEgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHJlbGF0aXZlQXJlYSh0cnVlLCBgJHsoMzMgLSBnZXRHcmFjZVdpZHRoUGVyY2VudChsYW5kc2NhcGUpKS50b0ZpeGVkKDIpfSVgKTtcbmNvbnN0IHF1YXJ0ZXJfcm93X2FyZWEgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHJlbGF0aXZlQXJlYSh0cnVlLCBgJHsoMjUgLSBnZXRHcmFjZVdpZHRoUGVyY2VudChsYW5kc2NhcGUpKS50b0ZpeGVkKDIpfSVgKTtcbmNvbnN0IGZpZnRoX3Jvd19hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEodHJ1ZSwgYCR7KDIwIC0gZ2V0R3JhY2VXaWR0aFBlcmNlbnQobGFuZHNjYXBlKSkudG9GaXhlZCgyKX0lYCk7XG5jb25zdCB0aW55X3Jvd19hcmVhID0gKF8/OiBhbnkpOiBzdHJpbmcgPT4gcmVsYXRpdmVBcmVhKHRydWUsIFwiMSVcIik7XG5jb25zdCBmbGV4aWJsZV9yb3dfYXJlYSA9IChfPzogYW55KTogc3RyaW5nID0+IHJlbGF0aXZlQW5kRmxleGlibGVBcmVhKHRydWUpO1xuXG5jb25zdCBmdWxsX2NvbF9hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEoZmFsc2UsIGAkeygxMDApLnRvRml4ZWQoMil9JWApO1xuY29uc3QgbmVhcl9mdWxsX2NvbF9hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEoZmFsc2UsIGAkeyg5OCkudG9GaXhlZCgyKX0lYCk7XG5jb25zdCB0d29UaGlyZHNfY29sX2FyZWEgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHJlbGF0aXZlQXJlYShmYWxzZSwgYCR7KDY2IC0gZ2V0R3JhY2VXaWR0aFBlcmNlbnQobGFuZHNjYXBlKSkudG9GaXhlZCgyKX0lYCk7XG5jb25zdCBoYWxmX2NvbF9hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEoZmFsc2UsIGAkeyg1MCAtIGdldEdyYWNlV2lkdGhQZXJjZW50KGxhbmRzY2FwZSkpLnRvRml4ZWQoMil9JWApO1xuY29uc3QgdGhpcmRfY29sX2FyZWEgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHJlbGF0aXZlQXJlYShmYWxzZSwgYCR7KDMzIC0gZ2V0R3JhY2VXaWR0aFBlcmNlbnQobGFuZHNjYXBlKSkudG9GaXhlZCgyKX0lYCk7XG5jb25zdCBxdWFydGVyX2NvbF9hcmVhID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiByZWxhdGl2ZUFyZWEoZmFsc2UsIGAkeygyNSAtIGdldEdyYWNlV2lkdGhQZXJjZW50KGxhbmRzY2FwZSkpLnRvRml4ZWQoMil9JWApO1xuY29uc3QgZmlmdGhfY29sX2FyZWEgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHJlbGF0aXZlQXJlYShmYWxzZSwgYCR7KDIwIC0gZ2V0R3JhY2VXaWR0aFBlcmNlbnQobGFuZHNjYXBlKSkudG9GaXhlZCgyKX0lYCk7XG5jb25zdCB0aW55X2NvbF9hcmVhID0gKF8/OiBhbnkpOiBzdHJpbmcgPT4gcmVsYXRpdmVBcmVhKGZhbHNlLCBcIjElXCIpO1xuY29uc3QgZmxleGlibGVfY29sX2FyZWEgPSAoXz86IGFueSk6IHN0cmluZyA9PiByZWxhdGl2ZUFuZEZsZXhpYmxlQXJlYShmYWxzZSk7XG5cbmNvbnN0IHplcm9fc3BhY2luZyA9IChfPzogYW55KTogc3RyaW5nID0+IFwicGFkZGluZzogMCAwIDAgMDsgbWFyZ2luOiAwIDAgMCAwO1wiO1xuY29uc3QgeHNfc3BhY2luZyA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDAuNSwgMSk7XG5jb25zdCBzX3NwYWNpbmcgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHNwYWNpbmcobGFuZHNjYXBlLCAxLCAxKTtcbmNvbnN0IG1fc3BhY2luZyA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDIsIDIpO1xuY29uc3QgbF9zcGFjaW5nID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiBzcGFjaW5nKGxhbmRzY2FwZSwgMywgMyk7XG5jb25zdCB4bF9zcGFjaW5nID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiBzcGFjaW5nKGxhbmRzY2FwZSwgNCwgNCk7XG5jb25zdCB4eGxfc3BhY2luZyA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDYsIDYpO1xuXG5jb25zdCB4c19zcGFjaW5nX3BhZGRpbmdPbmx5ID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiBzcGFjaW5nKGxhbmRzY2FwZSwgMC41LCAxLCB0cnVlLCBmYWxzZSk7XG5jb25zdCB4c19zcGFjaW5nX21hcmdpbk9ubHkgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHNwYWNpbmcobGFuZHNjYXBlLCAwLjUsIDEsIGZhbHNlLCB0cnVlKTtcblxuY29uc3Qgc19zcGFjaW5nX3BhZGRpbmdPbmx5ID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiBzcGFjaW5nKGxhbmRzY2FwZSwgMSwgMSwgdHJ1ZSwgZmFsc2UpO1xuY29uc3Qgc19zcGFjaW5nX21hcmdpbk9ubHkgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHNwYWNpbmcobGFuZHNjYXBlLCAxLCAxLCBmYWxzZSwgdHJ1ZSk7XG5cbmNvbnN0IG1fc3BhY2luZ19wYWRkaW5nT25seSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDIsIDEsIHRydWUsIGZhbHNlKTtcbmNvbnN0IG1fc3BhY2luZ19tYXJnaW5Pbmx5ID0gKGxhbmRzY2FwZTogYm9vbGVhbik6IHN0cmluZyA9PiBzcGFjaW5nKGxhbmRzY2FwZSwgMiwgMSwgZmFsc2UsIHRydWUpO1xuXG5jb25zdCBsX3NwYWNpbmdfcGFkZGluZ09ubHkgPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+IHNwYWNpbmcobGFuZHNjYXBlLCAzLCAxLCB0cnVlLCBmYWxzZSk7XG5jb25zdCBsX3NwYWNpbmdfbWFyZ2luT25seSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDMsIDEsIGZhbHNlLCB0cnVlKTtcblxuY29uc3QgeGxfc3BhY2luZ19wYWRkaW5nT25seSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDQsIDEsIHRydWUsIGZhbHNlKTtcbmNvbnN0IHhsX3NwYWNpbmdfbWFyZ2luT25seSA9IChsYW5kc2NhcGU6IGJvb2xlYW4pOiBzdHJpbmcgPT4gc3BhY2luZyhsYW5kc2NhcGUsIDQsIDEsIGZhbHNlLCB0cnVlKTtcblxuY29uc3Qgc2l6ZV9zX2ZvbnQgPSBgbWluKCR7KGZvbnRfdm1heF9taW4gKiBmb250U2NhbGVGYWN0b3Jfdm1heCkudG9GaXhlZCgyKX12bWF4LCAkeyhmb250X3B4X21pbiAqIGZvbnRTY2FsZUZhY3Rvcl9weCkudG9GaXhlZCgyKX1weClgO1xuY29uc3Qgc2l6ZV9tX2ZvbnQgPSBgbWluKCR7KGZvbnRfdm1heF9taW4gKiBmb250U2NhbGVJbmMgKiBmb250U2NhbGVGYWN0b3Jfdm1heCkudG9GaXhlZCgyKX12bWF4LCAkeyhmb250X3B4X21pbiAqIGZvbnRTY2FsZUluYyAqIGZvbnRTY2FsZUZhY3Rvcl9weCkudG9GaXhlZCgyKX1weClgO1xuY29uc3Qgc2l6ZV9sX2ZvbnQgPSBgbWluKCR7KGZvbnRfdm1heF9taW4gKiBmb250U2NhbGVJbmMyICogZm9udFNjYWxlRmFjdG9yX3ZtYXgpLnRvRml4ZWQoMil9dm1heCwgJHsoZm9udF9weF9taW4gKiBmb250U2NhbGVJbmMyICogZm9udFNjYWxlRmFjdG9yX3B4KS50b0ZpeGVkKDIpfXB4KWA7XG5jb25zdCBzaXplX3hsX2ZvbnQgPSBgbWluKCR7KGZvbnRfdm1heF9taW4gKiBmb250U2NhbGVJbmMzICogZm9udFNjYWxlRmFjdG9yX3ZtYXgpLnRvRml4ZWQoMil9dm1heCwgJHsoZm9udF9weF9taW4gKiBmb250U2NhbGVJbmMzICogZm9udFNjYWxlRmFjdG9yX3B4KS50b0ZpeGVkKDIpfXB4KWA7XG5jb25zdCBzaXplX3h4bF9mb250ID0gYG1pbigkeyhmb250X3ZtYXhfbWluICogZm9udFNjYWxlSW5jNCAqIGZvbnRTY2FsZUZhY3Rvcl92bWF4KS50b0ZpeGVkKDIpfXZtYXgsICR7KGZvbnRfcHhfbWluICogZm9udFNjYWxlSW5jNCAqIGZvbnRTY2FsZUZhY3Rvcl9weCkudG9GaXhlZCgyKX1weClgO1xuXG5jb25zdCBzX2ZvbnQgPSBmb250KHNpemVfc19mb250LCBmYWxzZSwgcmVndWxhcl9mb250X3dlaWdodCk7XG5jb25zdCBzX2l0YWxpY19mb250ID0gZm9udChzaXplX3NfZm9udCwgdHJ1ZSwgcmVndWxhcl9mb250X3dlaWdodCk7XG5jb25zdCBzX2JvbGRfZm9udCA9IGZvbnQoc2l6ZV9zX2ZvbnQsIGZhbHNlLCBib2xkX2ZvbnRfd2VpZ2h0KTtcbmNvbnN0IG1fZm9udCA9IGZvbnQoc2l6ZV9tX2ZvbnQsIHRydWUsIHJlZ3VsYXJfZm9udF93ZWlnaHQpO1xuY29uc3QgbV9ib2xkX2ZvbnQgPSBmb250KHNpemVfbV9mb250LCB0cnVlLCBib2xkX2ZvbnRfd2VpZ2h0KTtcbmNvbnN0IGxfZm9udCA9IGZvbnQoc2l6ZV9sX2ZvbnQsIHRydWUsIHJlZ3VsYXJfZm9udF93ZWlnaHQpO1xuY29uc3QgbF9ib2xkX2ZvbnQgPSBmb250KHNpemVfbF9mb250LCB0cnVlLCBib2xkX2ZvbnRfd2VpZ2h0KTtcbmNvbnN0IHhsX2ZvbnQgPSBmb250KHNpemVfeGxfZm9udCwgdHJ1ZSwgcmVndWxhcl9mb250X3dlaWdodCk7XG5jb25zdCB4bF9ib2xkX2ZvbnQgPSBmb250KHNpemVfeGxfZm9udCwgdHJ1ZSwgYm9sZF9mb250X3dlaWdodCk7XG5jb25zdCB4eGxfZm9udCA9IGZvbnQoc2l6ZV94eGxfZm9udCwgdHJ1ZSwgcmVndWxhcl9mb250X3dlaWdodCk7XG5jb25zdCB4eGxfYm9sZF9mb250ID0gZm9udChzaXplX3h4bF9mb250LCB0cnVlLCBib2xkX2ZvbnRfd2VpZ2h0KTtcblxuY29uc3QgdHJhbnNwYXJlbnRfZnJhbWUgPSBgb3BhY2l0eTogMDtgO1xuY29uc3QgbG9hZGluZ19zY3JlZW5fYmFja2dyb3VuZF9mcmFtZSA9IHNpbXBsZUZyYW1lKFwiIzAwMDAwMFwiLCBsaWdodENvbG9yLCAwLjcpO1xuY29uc3QgbG9hZGluZ19zY3JlZW5fY29udGVudF9mcmFtZSA9IGVsZXZhdGVkRnJhbWUobGlnaHRZZWxsb3dDb2xvciwgZGFya0NvbG9yLCBtZWRpdW1ZZWxsb3dDb2xvciwgXCIxLjI1XCIpO1xuY29uc3QgcG9wdXBfc2NyZWVuX2JhY2tncm91bmRfZnJhbWUgPSBzaW1wbGVGcmFtZShcIiMwMDAwMDBcIiwgbGlnaHRDb2xvciwgMC43KTtcbmNvbnN0IHBvcHVwX3NjcmVlbl9jb250ZW50X2ZyYW1lID0gZWxldmF0ZWRGcmFtZShkYXJrQ29sb3IsIG1lZGl1bUNvbG9yLCBsaWdodENvbG9yLCBcIjEuMjVcIik7XG5jb25zdCBsaWdodF9jb2xvcl9mcmFtZSA9IHNpbXBsZUZyYW1lKGRhcmtDb2xvciwgbGlnaHRDb2xvcik7XG5jb25zdCB1bmRlcmxpbmVkX2xpZ2h0X2NvbG9yX2ZyYW1lID0gdW5kZXJsaW5lZEZyYW1lKGRhcmtDb2xvciwgbGlnaHRDb2xvciwgbGlnaHRDb2xvcik7XG5jb25zdCBtZWRpdW1fY29sb3JfZnJhbWUgPSBzaW1wbGVGcmFtZShkYXJrQ29sb3IsIG1lZGl1bUNvbG9yKTtcbmNvbnN0IGludmVydGVkX21lZGl1bV9jb2xvcl9mcmFtZSA9IHNpbXBsZUZyYW1lKG1lZGl1bUNvbG9yLCBkYXJrQ29sb3IpO1xuY29uc3QgZGltX2NvbG9yX2ZyYW1lID0gc2ltcGxlRnJhbWUoZGFya0NvbG9yLCBkaW1Db2xvcik7XG5jb25zdCBsaWdodFllbGxvd19jb2xvcl9mcmFtZSA9IHNpbXBsZUZyYW1lKGRhcmtDb2xvciwgbGlnaHRZZWxsb3dDb2xvcik7XG5jb25zdCBtZWRpdW1ZZWxsb3dfY29sb3JfZnJhbWUgPSBzaW1wbGVGcmFtZShkYXJrQ29sb3IsIG1lZGl1bVllbGxvd0NvbG9yKTtcbmNvbnN0IGxpbmtJbWFnZV9mcmFtZSA9IGVsZXZhdGVkRnJhbWUoZGFya0NvbG9yLCBtZWRpdW1Db2xvciwgbWVkaXVtQ29sb3IpO1xuY29uc3QgaW1nX2ZyYW1lID0gcm91bmRlZEZyYW1lKGRhcmtDb2xvciwgbGlnaHRDb2xvcik7XG5jb25zdCBzbmlwcGV0X2ZyYW1lID0gcm91bmRlZEZyYW1lKGV4dHJhRGFya0NvbG9yLCBsaWdodEdyZWVuQ29sb3IpO1xuY29uc3QgZXhjZXJwdF9mcmFtZSA9IHJvdW5kZWRGcmFtZShleHRyYURhcmtDb2xvciwgbGlnaHRHcmVlbkNvbG9yKTtcbmNvbnN0IGJ1dHRvbl9mcmFtZSA9IGVsZXZhdGVkRnJhbWUoZXh0cmFEYXJrQ29sb3IsIG1lZGl1bUNvbG9yLCBkaW1Db2xvciwgXCIwLjVcIik7XG5jb25zdCBiaWdfYnV0dG9uX2ZyYW1lID0gZWxldmF0ZWRGcmFtZShleHRyYURhcmtDb2xvciwgbWVkaXVtQ29sb3IsIGRpbUNvbG9yLCBcIjAuNzVcIik7XG5jb25zdCB0ZXh0X2lucHV0X2ZyYW1lID0gZWxldmF0ZWRGcmFtZShkaW1Db2xvciwgbGlnaHRDb2xvciwgbWVkaXVtQ29sb3IsIFwiMC4yNVwiKTtcbmNvbnN0IGxpc3Rfc2Nyb2xsX3BhbmVsX2ZyYW1lID0gb3V0bGluZWRGcmFtZShkYXJrQ29sb3IsIGxpZ2h0Q29sb3IsIGRpbUNvbG9yLCBcIjAuMVwiKTtcbmNvbnN0IGxpc3RfaXRlbV9mcmFtZSA9IG91dGxpbmVkRnJhbWUobWVkaXVtQ29sb3IsIGxpZ2h0Q29sb3IsIGxpZ2h0Q29sb3IsIFwiMC4xXCIpO1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gT3JpZW50YXRpb24tRGVwZW5kZW50IFN0eWxlc1xuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3Qgc3R5bGVzRm9yT3JpZW50YXRpb24gPSAobGFuZHNjYXBlOiBib29sZWFuKTogc3RyaW5nID0+XG5gXG5Ac3VwcG9ydHMoLW1vei1hcHBlYXJhbmNlOm5vbmUpIHtcblx0KiB7XG5cdFx0c2Nyb2xsYmFyLXdpZHRoOiAke2xhbmRzY2FwZSA/IFwiYXV0b1wiIDogXCJub25lXCJ9O1xuXHRcdHNjcm9sbGJhci1jb2xvcjogJHtkaW1Db2xvcn0gJHtleHRyYURhcmtDb2xvcn07XG5cdH1cbn1cbjo6LXdlYmtpdC1zY3JvbGxiYXIge1xuXHR3aWR0aDogJHtsYW5kc2NhcGUgPyBzY3JvbGxiYXJfdGhpY2tuZXNzIDogXCIwXCJ9O1xuXHRoZWlnaHQ6ICR7bGFuZHNjYXBlID8gc2Nyb2xsYmFyX3RoaWNrbmVzcyA6IFwiMFwifTtcbn1cbjo6LXdlYmtpdC1zY3JvbGxiYXItdHJhY2sge1xuXHRiYWNrZ3JvdW5kOiAke2V4dHJhRGFya0NvbG9yfTtcbn1cbjo6LXdlYmtpdC1zY3JvbGxiYXItdGh1bWIge1xuXHRiYWNrZ3JvdW5kOiAke2RpbUNvbG9yfTtcblx0Ym9yZGVyLXJhZGl1czogJHtzY3JvbGxiYXJfYm9yZGVyX3JhZGl1c307XG5cdGJvcmRlcjogJHtzY3JvbGxiYXJfYm9yZGVyX3RoaWNrbmVzc30gc29saWQgJHtleHRyYURhcmtDb2xvcn07XG59XG46Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iOmhvdmVyIHtcblx0YmFja2dyb3VuZDogJHttZWRpdW1Db2xvcn07XG59XG5pZnJhbWUge1xuXHQke2Z1bGxfcm93X2FyZWEobGFuZHNjYXBlKX1cblx0JHttX3NwYWNpbmdfbWFyZ2luT25seShsYW5kc2NhcGUpfVxuXHQke2xfYm9sZF9mb250fVxuXHQke21lZGl1bV9jb2xvcl9mcmFtZX1cbn1cbnAge1xuXHQke2Z1bGxfcm93X2FyZWEobGFuZHNjYXBlKX1cblx0JHt4bF9zcGFjaW5nX21hcmdpbk9ubHkobGFuZHNjYXBlKX1cblx0JHtzX2ZvbnR9XG5cdCR7bGlnaHRfY29sb3JfZnJhbWV9XG59XG5oMyB7XG5cdCR7ZnVsbF9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke3hsX3NwYWNpbmdfbWFyZ2luT25seShsYW5kc2NhcGUpfVxuXHQke21fYm9sZF9mb250fVxuXHQke21lZGl1bVllbGxvd19jb2xvcl9mcmFtZX1cbn1cbmgyIHtcblx0JHtmdWxsX3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7eGxfc3BhY2luZ19tYXJnaW5Pbmx5KGxhbmRzY2FwZSl9XG5cdCR7eGxfYm9sZF9mb250fVxuXHQke2RpbV9jb2xvcl9mcmFtZX1cbn1cbmgxIHtcblx0JHtmdWxsX3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7eGxfc3BhY2luZ19tYXJnaW5Pbmx5KGxhbmRzY2FwZSl9XG5cdCR7eHhsX2JvbGRfZm9udH1cblx0JHtsaWdodFllbGxvd19jb2xvcl9mcmFtZX1cbn1cbmhyIHtcblx0JHtmdWxsX3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7bV9zcGFjaW5nX21hcmdpbk9ubHkobGFuZHNjYXBlKX1cblx0JHtsaWdodF9jb2xvcl9mcmFtZX1cbn1cbi5mdWxsc2NyZWVuQmFyIHtcblx0JHtsYW5kc2NhcGUgPyBmdWxsc2NyZWVuX2xlZnRfYmFyX2FyZWEgOiBmdWxsc2NyZWVuX3RvcF9iYXJfYXJlYX1cblx0JHt6ZXJvX3NwYWNpbmcobGFuZHNjYXBlKX1cblx0JHttX2JvbGRfZm9udH1cblx0JHtpbnZlcnRlZF9tZWRpdW1fY29sb3JfZnJhbWV9XG5cdHRleHQtYWxpZ246ICR7ZnVsbHNjcmVlbkJhclRleHRBbGlnbn07XG5cdHotaW5kZXg6IDE7XG5cdG92ZXJmbG93OiBoaWRkZW47XG59XG4uZnVsbHNjcmVlblBhbmVsIHtcblx0JHtsYW5kc2NhcGUgPyBmdWxsc2NyZWVuX3JpZ2h0X3BhbmVsX2FyZWEgOiBmdWxsc2NyZWVuX2JvdHRvbV9wYW5lbF9hcmVhfVxuXHRtYXJnaW46IDAgMCAwIDA7XG5cdHBhZGRpbmc6IDAgJHtmdWxsc2NyZWVuUGFuZWxXaWR0aFBhZGRpbmdQZXJjZW50fSUgMCAke2Z1bGxzY3JlZW5QYW5lbFdpZHRoUGFkZGluZ1BlcmNlbnR9JTtcblx0JHtsX2JvbGRfZm9udH1cblx0JHttZWRpdW1fY29sb3JfZnJhbWV9XG5cdG92ZXJmbG93LXk6IHNjcm9sbDtcblx0b3ZlcmZsb3cteDogYXV0bztcbn1cbi5mdWxsc2NyZWVuQmFyTG9nbyB7XG5cdCR7bGFuZHNjYXBlID8gZnVsbHNjcmVlbl9sZWZ0X2Jhcl9sb2dvX2FyZWEgOiBmdWxsc2NyZWVuX3RvcF9iYXJfbG9nb19hcmVhfVxufVxuLmZ1bGxzY3JlZW5CYXJMb2dvSW1hZ2Uge1xuXHRwb3NpdGlvbjogcmVsYXRpdmU7XG5cdGRpc3BsYXk6IGJsb2NrO1xuXHRtYXgtd2lkdGg6IDgwJTtcblx0bWF4LWhlaWdodDogNzAlO1xuXHRtYXJnaW46IGF1dG87XG4gIFx0dG9wOiA1MCU7XG4gIFx0LW1zLXRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKTtcbiAgXHR0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSk7XG59XG4uZnVsbHNjcmVlbkJhck1lbnUge1xuXHQke2xhbmRzY2FwZSA/IGZ1bGxzY3JlZW5fbGVmdF9iYXJfbWVudV9hcmVhIDogZnVsbHNjcmVlbl90b3BfYmFyX21lbnVfYXJlYX1cbn1cbi5mdWxsc2NyZWVuQmFyTWVudUJ1dHRvbiB7XG5cdHBvc2l0aW9uOiByZWxhdGl2ZTtcblx0ZGlzcGxheTogJHtsYW5kc2NhcGUgPyBcImJsb2NrXCIgOiBcImlubGluZS1ibG9ja1wifTtcblx0JHtsYW5kc2NhcGUgPyBcIndpZHRoOiAxMDAlO1wiIDogXCJ0b3A6IDEwMCU7IC1tcy10cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwMCUpOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwMCUpO1wifVxuXHRtYXgtaGVpZ2h0OiAxMDAlO1xuXHQke2xhbmRzY2FwZSA/IHhsX3NwYWNpbmdfcGFkZGluZ09ubHkobGFuZHNjYXBlKSA6IHNfc3BhY2luZ19wYWRkaW5nT25seShsYW5kc2NhcGUpfVxuXHRib3gtc2l6aW5nOiBib3JkZXItYm94O1xuXHR0ZXh0LWRlY29yYXRpb246IG5vbmU7XG59XG4uZnVsbHNjcmVlbkJhck1lbnVCdXR0b24uaWRsZSB7XG5cdCR7aW52ZXJ0ZWRfbWVkaXVtX2NvbG9yX2ZyYW1lfVxufVxuLmZ1bGxzY3JlZW5CYXJNZW51QnV0dG9uLnNlbGVjdGVkIHtcblx0JHttZWRpdW1fY29sb3JfZnJhbWV9XG59XG4uZnVsbHNjcmVlbkJhck1lbnVCdXR0b24uaWRsZTpob3ZlciB7XG5cdGNvbG9yOiAke2xpZ2h0WWVsbG93Q29sb3J9O1xufVxuLmZ1bGxzY3JlZW5CYXJNZW51QnV0dG9uLnNlbGVjdGVkOmhvdmVyIHtcblx0Y29sb3I6ICR7bGlnaHRZZWxsb3dDb2xvcn07XG59XG4ubG9hZGluZ1NjcmVlbiB7XG5cdCR7ZnVsbHNjcmVlbl93aG9sZV9hcmVhfVxuXHQke3plcm9fc3BhY2luZyhsYW5kc2NhcGUpfVxuXHR6LWluZGV4OiA5MDA7XG5cblx0LmJhY2tncm91bmQge1xuXHRcdCR7ZnVsbHNjcmVlbl93aG9sZV9hcmVhfVxuXHRcdCR7emVyb19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdFx0JHtsb2FkaW5nX3NjcmVlbl9iYWNrZ3JvdW5kX2ZyYW1lfVxuXHR9XG5cdC5jb250ZW50IHtcblx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XG5cdFx0bWluLXdpZHRoOiA1MCU7XG5cdFx0dG9wOiA1MCU7XG5cdFx0bGVmdDogNTAlO1xuXHRcdHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuXHRcdCR7eHhsX2JvbGRfZm9udH1cblx0XHQke3hsX3NwYWNpbmcobGFuZHNjYXBlKX1cblx0XHQke2xvYWRpbmdfc2NyZWVuX2NvbnRlbnRfZnJhbWV9XG5cdFx0dGV4dC1hbGlnbjogY2VudGVyO1xuXHRcdHotaW5kZXg6IDkwMTtcblx0fVxufVxuLnBvcHVwU2NyZWVuIHtcblx0JHtmdWxsc2NyZWVuX3dob2xlX2FyZWF9XG5cdCR7emVyb19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdHotaW5kZXg6IDUwMDtcblxuXHQuYmFja2dyb3VuZCB7XG5cdFx0JHtmdWxsc2NyZWVuX3dob2xlX2FyZWF9XG5cdFx0JHt6ZXJvX3NwYWNpbmcobGFuZHNjYXBlKX1cblx0XHQke3BvcHVwX3NjcmVlbl9iYWNrZ3JvdW5kX2ZyYW1lfVxuXHR9XG5cdC5jb250ZW50IHtcblx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XG5cdFx0d2lkdGg6IDgwJTtcblx0XHR3aWR0aDogODAlO1xuXHRcdHRvcDogNTAlO1xuXHRcdGxlZnQ6IDUwJTtcblx0XHR0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcblx0XHQke3NfZm9udH1cblx0XHQke21fc3BhY2luZyhsYW5kc2NhcGUpfVxuXHRcdCR7cG9wdXBfc2NyZWVuX2NvbnRlbnRfZnJhbWV9XG5cdFx0b3ZlcmZsb3cteTogc2Nyb2xsO1xuXHRcdHotaW5kZXg6IDUwMTtcblx0fVxufVxuLnNfaW1hZ2Uge1xuXHQke2xhbmRzY2FwZSA/IHF1YXJ0ZXJfY29sX2FyZWEobGFuZHNjYXBlKSA6IGhhbGZfY29sX2FyZWEobGFuZHNjYXBlKX1cblx0JHttX3NwYWNpbmdfbWFyZ2luT25seShsYW5kc2NhcGUpfVxuXHQke2xfYm9sZF9mb250fVxuXHQke2ltZ19mcmFtZX1cbn1cbi5tX2ltYWdlIHtcblx0JHtsYW5kc2NhcGUgPyB0aGlyZF9jb2xfYXJlYShsYW5kc2NhcGUpIDogZnVsbF9jb2xfYXJlYShsYW5kc2NhcGUpfVxuXHQke21fc3BhY2luZ19tYXJnaW5Pbmx5KGxhbmRzY2FwZSl9XG5cdCR7bF9ib2xkX2ZvbnR9XG5cdCR7aW1nX2ZyYW1lfVxufVxuLm1fbGlua0ltYWdlIHtcblx0JHtsYW5kc2NhcGUgPyB0aGlyZF9jb2xfYXJlYShsYW5kc2NhcGUpIDogbmVhcl9mdWxsX2NvbF9hcmVhKGxhbmRzY2FwZSl9XG5cdCR7bV9zcGFjaW5nX21hcmdpbk9ubHkobGFuZHNjYXBlKX1cblx0JHtsX2JvbGRfZm9udH1cblx0JHtsaW5rSW1hZ2VfZnJhbWV9XG59XG4ubV9saW5rSW1hZ2U6aG92ZXIge1xuXHRib3JkZXItY29sb3I6ICR7bGlnaHRZZWxsb3dDb2xvcn07XG59XG4ubF9pbWFnZSB7XG5cdCR7bGFuZHNjYXBlID8gaGFsZl9jb2xfYXJlYShsYW5kc2NhcGUpIDogZnVsbF9jb2xfYXJlYShsYW5kc2NhcGUpfVxuXHQke21fc3BhY2luZ19tYXJnaW5Pbmx5KGxhbmRzY2FwZSl9XG5cdCR7bF9ib2xkX2ZvbnR9XG5cdCR7aW1nX2ZyYW1lfVxufVxuLnBvcnRhbCB7XG5cdHBvc2l0aW9uOiByZWxhdGl2ZTtcblx0ZGlzcGxheTogYmxvY2s7XG5cdG1hcmdpbjogJHtsYW5kc2NhcGUgPyBcIjUlXCIgOiBcIjEyLjUlXCJ9IDA7XG5cdHBhZGRpbmc6IDAgMDtcblx0bWF4LXdpZHRoOiAke2xhbmRzY2FwZSA/IFwiMzAlXCIgOiBcIjcwJVwifTtcbn1cbi5wb3N0RW50cnlCdXR0b24ge1xuXHQke2ZsZXhpYmxlX3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7c19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7c19ib2xkX2ZvbnR9XG5cdCR7YnV0dG9uX2ZyYW1lfVxuXHR0ZXh0LWRlY29yYXRpb246IG5vbmU7XG59XG4ucG9zdEVudHJ5QnV0dG9uOmhvdmVyIHtcblx0Ym9yZGVyLWNvbG9yOiAke2xpZ2h0WWVsbG93Q29sb3J9O1xufVxuLmJpZ0J1dHRvbiB7XG5cdCR7ZmxleGlibGVfcm93X2FyZWEobGFuZHNjYXBlKX1cblx0JHt4eGxfc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke21fYm9sZF9mb250fVxuXHQke2JpZ19idXR0b25fZnJhbWV9XG5cdHRleHQtZGVjb3JhdGlvbjogbm9uZTtcblx0dGV4dC1hbGlnbjogY2VudGVyO1xufVxuLmJpZ0J1dHRvbjpob3ZlciB7XG5cdGJvcmRlci1jb2xvcjogJHtsaWdodFllbGxvd0NvbG9yfTtcbn1cbi5wYWdlUGF0aCB7XG5cdCR7c19zcGFjaW5nX21hcmdpbk9ubHkobGFuZHNjYXBlKX1cblx0JHtzX2ZvbnR9XG59XG4ubGlzdFNjcm9sbFBhbmVsIHtcblx0JHtsaXN0X3Njcm9sbF9wYW5lbF9hcmVhKGxhbmRzY2FwZSl9XG5cdCR7c19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7bGlzdF9zY3JvbGxfcGFuZWxfZnJhbWV9XG5cdG92ZXJmbG93OiBhdXRvO1xufVxuLmxpc3RJdGVtIHtcblx0JHtmbGV4aWJsZV9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke3Nfc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3NfZm9udH1cblx0JHtsaXN0X2l0ZW1fZnJhbWV9XG5cdHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbn1cbi5pbmxpbmVUZXh0SW5wdXQge1xuXHQke2xhbmRzY2FwZSA/IGZsZXhpYmxlX2NvbF9hcmVhKGxhbmRzY2FwZSkgOiBmbGV4aWJsZV9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke2xhbmRzY2FwZSA/IHNfc3BhY2luZyhsYW5kc2NhcGUpIDogc19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7c19mb250fVxuXHQke3RleHRfaW5wdXRfZnJhbWV9XG59XG4uaW5saW5lTGFiZWwge1xuXHQke2ZsZXhpYmxlX2NvbF9hcmVhKGxhbmRzY2FwZSl9XG5cdCR7c19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7c19mb250fVxuXHQke21lZGl1bV9jb2xvcl9mcmFtZX1cbn1cbi5pbmxpbmVCdXR0b24ge1xuXHQke2ZsZXhpYmxlX2NvbF9hcmVhKGxhbmRzY2FwZSl9XG5cdCR7c19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7c19mb250fVxuXHQke2J1dHRvbl9mcmFtZX1cblx0dGV4dC1kZWNvcmF0aW9uOiBub25lO1xufVxuLmlubGluZUJ1dHRvbjpob3ZlciB7XG5cdGJvcmRlci1jb2xvcjogJHtsaWdodFllbGxvd0NvbG9yfTtcblx0Y3Vyc29yOiBwb2ludGVyO1xufVxuLmlubGluZUJ1dHRvbjpkaXNhYmxlZCB7XG5cdG9wYWNpdHk6IDAuMjU7XG5cdGN1cnNvcjogbm90LWFsbG93ZWQ7XG59XG4uaW5saW5lVGFiQnV0dG9uIHtcblx0JHtmbGV4aWJsZV9jb2xfYXJlYShsYW5kc2NhcGUpfVxuXHQke3Nfc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3NfZm9udH1cblx0dGV4dC1kZWNvcmF0aW9uOiBub25lO1xufVxuLmlubGluZVRhYkJ1dHRvbi5pZGxlIHtcblx0JHtsaWdodF9jb2xvcl9mcmFtZX1cbn1cbi5pbmxpbmVUYWJCdXR0b24uc2VsZWN0ZWQge1xuXHQke3VuZGVybGluZWRfbGlnaHRfY29sb3JfZnJhbWV9XG59XG4uaW5saW5lVGFiQnV0dG9uLmlkbGU6aG92ZXIge1xuXHRjb2xvcjogJHtsaWdodFllbGxvd0NvbG9yfTtcbn1cbi5pbmxpbmVUYWJCdXR0b24uc2VsZWN0ZWQ6aG92ZXIge1xuXHRjb2xvcjogJHtsaWdodFllbGxvd0NvbG9yfTtcbn1cbi5zbmlwcGV0IHtcblx0JHtmbGV4aWJsZV9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke21fc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3NfYm9sZF9mb250fVxuXHQke3NuaXBwZXRfZnJhbWV9XG5cdHdoaXRlLXNwYWNlOiBub3dyYXA7XG59XG4uZXhjZXJwdCB7XG5cdCR7ZnVsbF9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke21fc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3NfaXRhbGljX2ZvbnR9XG5cdCR7ZXhjZXJwdF9mcmFtZX1cblx0d2hpdGUtc3BhY2U6IHByZS13cmFwO1xuXHR3aGl0ZS1zcGFjZTogLW1vei1wcmUtd3JhcDtcblx0d2hpdGUtc3BhY2U6IC1wcmUtd3JhcDtcblx0d2hpdGUtc3BhY2U6IC1vLXByZS13cmFwO1xuXHR3b3JkLXdyYXA6IGJyZWFrLXdvcmQ7XG59XG4uemVyb19yb3cge1xuXHQke3Rpbnlfcm93X2FyZWEoKX1cblx0JHt6ZXJvX3NwYWNpbmcoKX1cblx0JHt0cmFuc3BhcmVudF9mcmFtZX1cbn1cbi54c19yb3cge1xuXHQke3Rpbnlfcm93X2FyZWEobGFuZHNjYXBlKX1cblx0JHt4c19zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7dHJhbnNwYXJlbnRfZnJhbWV9XG59XG4uc19yb3cge1xuXHQke3Rpbnlfcm93X2FyZWEobGFuZHNjYXBlKX1cblx0JHtzX3NwYWNpbmcobGFuZHNjYXBlKX1cblx0JHt0cmFuc3BhcmVudF9mcmFtZX1cbn1cbi5tX3JvdyB7XG5cdCR7dGlueV9yb3dfYXJlYShsYW5kc2NhcGUpfVxuXHQke21fc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3RyYW5zcGFyZW50X2ZyYW1lfVxufVxuLmxfcm93IHtcblx0JHt0aW55X3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7bF9zcGFjaW5nKGxhbmRzY2FwZSl9XG5cdCR7dHJhbnNwYXJlbnRfZnJhbWV9XG59XG4ueGxfcm93IHtcblx0JHt0aW55X3Jvd19hcmVhKGxhbmRzY2FwZSl9XG5cdCR7eGxfc3BhY2luZyhsYW5kc2NhcGUpfVxuXHQke3RyYW5zcGFyZW50X2ZyYW1lfVxufVxuYDtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENTU1xuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgY3NzID1cbmAqIHtcblx0b3ZlcmZsb3c6IGhpZGRlbjtcblx0dmVydGljYWwtYWxpZ246IG1pZGRsZTtcbn1cbmJvZHkge1xuXHQke2Z1bGxzY3JlZW5fd2hvbGVfYXJlYX1cblx0JHt6ZXJvX3NwYWNpbmcoKX1cblx0JHtzX2ZvbnR9XG5cdCR7bGlnaHRfY29sb3JfZnJhbWV9XG5cdHRleHQtYWxpZ246ICR7ZGVmYXVsdFRleHRBbGlnbn07XG5cdHotaW5kZXg6IDA7XG59XG5hOmxpbmsge1xuICBjb2xvcjogJHttZWRpdW1Db2xvcn07XG59XG5hOnZpc2l0ZWQge1xuICBjb2xvcjogJHttZWRpdW1Db2xvcn07XG59XG5hOmhvdmVyIHtcbiAgY29sb3I6ICR7bGlnaHRZZWxsb3dDb2xvcn07XG59XG5hOmFjdGl2ZSB7XG4gIGNvbG9yOiAke21lZGl1bUNvbG9yfTtcbn1cbi5kaW0ge1xuXHQke2RpbV9jb2xvcl9mcmFtZX1cbn1cbi5ub1RleHREZWNvIHtcblx0dGV4dC1kZWNvcmF0aW9uOiBub25lO1xufVxuLmhvcml6b250YWxseUNlbnRlcmVkIHtcblx0bGVmdDogNTAlO1xuXHR0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAwKTtcbn1cblxuQG1lZGlhIChvcmllbnRhdGlvbjogbGFuZHNjYXBlKSB7XG5cdCR7c3R5bGVzRm9yT3JpZW50YXRpb24odHJ1ZSl9XG59XG5cbkBtZWRpYSAob3JpZW50YXRpb246IHBvcnRyYWl0KSB7XG5cdCR7c3R5bGVzRm9yT3JpZW50YXRpb24oZmFsc2UpfVxufWA7XG5cbmV4cG9ydCBkZWZhdWx0IGNzczsiLCJpbXBvcnQgand0IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdFwiO1xuaW1wb3J0IEVtYWlsVXRpbCBmcm9tIFwiLi9lbWFpbFV0aWxcIjtcbmltcG9ydCBTZWFyY2hEQiBmcm9tIFwiLi4vZGIvc2VhcmNoREJcIjtcbmltcG9ydCBBdXRoREIgZnJvbSBcIi4uL2RiL2F1dGhEQlwiO1xuaW1wb3J0IFRleHRVdGlsIGZyb20gXCIuLi8uLi9zaGFyZWQvZW1iZWRkZWRTY3JpcHRzL3V0aWwvdGV4dFV0aWxcIjtcbmltcG9ydCBEZWJ1Z1V0aWwgZnJvbSBcIi4vZGVidWdVdGlsXCI7XG5pbXBvcnQgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcbmltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBVSUNvbmZpZyBmcm9tIFwiLi4vLi4vc2hhcmVkL2VtYmVkZGVkU2NyaXB0cy9jb25maWcvdWlDb25maWdcIjtcbmltcG9ydCBVc2VyIGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXMvZGIvdXNlclwiO1xuZG90ZW52LmNvbmZpZygpO1xuXG5jb25zdCBkZXYgPSBwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCI7XG5sZXQgY3ljbGljQ291bnRlciA9IDA7XG5cbmNvbnN0IEF1dGhVdGlsID1cbntcbiAgICByZWdpc3RlcjogYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IFByb21pc2U8dm9pZD4gPT5cbiAgICB7XG4gICAgICAgIHRyeVxuICAgICAgICB7XG4gICAgICAgICAgICBpZiAoIXZhbGlkYXRlVXNlck5hbWVBbmRQYXNzd29yZChyZXEsIHJlcykpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBlbWFpbEVycm9yID0gVGV4dFV0aWwuZmluZEVycm9ySW5FbWFpbEFkZHJlc3MocmVxLmJvZHkuZW1haWwpO1xuICAgICAgICAgICAgaWYgKGVtYWlsRXJyb3IgIT0gbnVsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiRW1haWwgSW5wdXQgRXJyb3JcIiwge2VtYWlsOiByZXEuYm9keS5lbWFpbCwgZW1haWxFcnJvcn0sIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDApLnNlbmQoVUlDb25maWcuZGlzcGxheVRleHQubWVzc2FnZVtlbWFpbEVycm9yXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhpc3RpbmdVc2VycyA9IGF3YWl0IFNlYXJjaERCLnVzZXJzLndpdGhVc2VyTmFtZShyZXEuYm9keS51c2VyTmFtZSwgcmVzKTtcbiAgICAgICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA8IDIwMCB8fCByZXMuc3RhdHVzQ29kZSA+PSAzMDApXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nVXNlcnMgJiYgZXhpc3RpbmdVc2Vycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJVc2VyTmFtZSBhbHJlYWR5IGV4aXN0c1wiLCB7dXNlck5hbWU6IHJlcS5ib2R5LnVzZXJOYW1lLCBleGlzdGluZ1VzZXI6IGV4aXN0aW5nVXNlcnNbMF19LCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKS5zZW5kKGBVc2VyIFwiJHtyZXEuYm9keS51c2VyTmFtZX1cIiBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGV4aXN0aW5nVXNlcnMgPSBhd2FpdCBTZWFyY2hEQi51c2Vycy53aXRoRW1haWwocmVxLmJvZHkuZW1haWwsIHJlcyk7XG4gICAgICAgICAgICBpZiAocmVzLnN0YXR1c0NvZGUgPCAyMDAgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ1VzZXJzICYmIGV4aXN0aW5nVXNlcnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiVGhlcmUgaXMgYWxyZWFkeSBhbiBhY2NvdW50IHdpdGggdGhlIHNhbWUgZW1haWxcIiwge2VtYWlsOiByZXEuYm9keS5lbWFpbCwgZXhpc3RpbmdVc2VyOiBleGlzdGluZ1VzZXJzWzBdfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDQwMykuc2VuZChgVGhlcmUgaXMgYWxyZWFkeSBhbiBhY2NvdW50IHdpdGggdGhlIGVtYWlsIFwiJHtyZXEuYm9keS5lbWFpbH1cIi5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgXG4gICAgICAgICAgICBhd2FpdCBFbWFpbFV0aWwuZW5kRW1haWxWZXJpZmljYXRpb24ocmVxLCByZXMpO1xuICAgICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlIDwgMjAwIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgXG4gICAgICAgICAgICBjb25zdCBwYXNzd29yZEhhc2ggPSBhd2FpdCBiY3J5cHQuaGFzaChyZXEuYm9keS5wYXNzd29yZCwgMTApO1xuICAgIFxuICAgICAgICAgICAgYXdhaXQgQXV0aERCLnJlZ2lzdGVyTmV3VXNlcihyZXEuYm9keS51c2VyTmFtZSwgcGFzc3dvcmRIYXNoLCByZXEuYm9keS5lbWFpbCwgcmVzKTtcbiAgICAgICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA8IDIwMCB8fCByZXMuc3RhdHVzQ29kZSA+PSAzMDApXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBhd2FpdCBhZGRUb2tlbkZvclJlZ2lzdGVyZWRVc2VyKHJlcS5ib2R5LnVzZXJOYW1lLCByZXMpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJVc2VyIFJlZ2lzdHJhdGlvbiBFcnJvclwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKGBFUlJPUjogRmFpbGVkIHRvIHJlZ2lzdGVyIHRoZSB1c2VyICgke2Vycn0pLmApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBsb2dpbjogYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IFByb21pc2U8dm9pZD4gPT5cbiAgICB7XG4gICAgICAgIHRyeVxuICAgICAgICB7XG4gICAgICAgICAgICBpZiAoIXZhbGlkYXRlVXNlck5hbWVBbmRQYXNzd29yZChyZXEsIHJlcykpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgZmluZEV4aXN0aW5nVXNlckJ5VXNlck5hbWUocmVxLmJvZHkudXNlck5hbWUsIHJlcyk7XG4gICAgICAgICAgICBpZiAoIXVzZXIpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB2YWxpZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUocmVxLmJvZHkucGFzc3dvcmQsIHVzZXIucGFzc3dvcmRIYXNoKTtcblxuICAgICAgICAgICAgaWYgKCF2YWxpZFBhc3N3b3JkKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJXcm9uZyBwYXNzd29yZFwiLCB7cGFzc3dvcmRFbnRlcmVkOiAoZGV2ID8gcmVxLmJvZHkucGFzc3dvcmQgOiBcIihISURERU4pXCIpLCBwYXNzd29yZEhhc2g6IHVzZXIucGFzc3dvcmRIYXNofSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDQwMSkuc2VuZChcIldyb25nIHBhc3N3b3JkLlwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IGFkZFRva2VuRm9yUmVnaXN0ZXJlZFVzZXIocmVxLmJvZHkudXNlck5hbWUsIHJlcyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycilcbiAgICAgICAge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkxvZ2luIEVycm9yXCIsIHtlcnJ9LCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLnNlbmQoYEVSUk9SOiBGYWlsZWQgdG8gbG9naW4gKCR7ZXJyfSkuYCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFVzZXJGcm9tVG9rZW46ICh0b2tlbjogc3RyaW5nKTogVXNlciB8IG51bGwgPT5cbiAgICB7XG4gICAgICAgIHJldHVybiBnZXRVc2VyRnJvbVRva2VuKHRva2VuKTtcbiAgICB9LFxuICAgIGNsZWFyVG9rZW46IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpOiB2b2lkID0+XG4gICAge1xuICAgICAgICByZXMuY2xlYXJDb29raWUoXCJ0aGluZ3Nwb29sX3Rva2VuXCIpLnN0YXR1cygyMDApO1xuICAgIH0sXG4gICAgYXV0aGVudGljYXRlQWRtaW46IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+ID0+XG4gICAge1xuICAgICAgICBhd2FpdCBhdXRoZW50aWNhdGUocmVxLCByZXMsIHVzZXIgPT4gdXNlci51c2VyVHlwZSA9PSBcImFkbWluXCIsIG5leHQpO1xuICAgIH0sXG4gICAgYXV0aGVudGljYXRlUmVnaXN0ZXJlZFVzZXI6IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+ID0+XG4gICAge1xuICAgICAgICBhd2FpdCBhdXRoZW50aWNhdGUocmVxLCByZXMsIHVzZXIgPT4gdXNlci51c2VyVHlwZSA9PSBcImFkbWluXCIgfHwgdXNlci51c2VyVHlwZSA9PSBcIm1lbWJlclwiLCBuZXh0KTtcbiAgICB9LFxuICAgIGF1dGhlbnRpY2F0ZUFueVVzZXI6IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+ID0+XG4gICAge1xuICAgICAgICBhd2FpdCBhdXRoZW50aWNhdGUocmVxLCByZXMsIF8gPT4gdHJ1ZSwgbmV4dCk7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhdXRoZW50aWNhdGUocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLFxuICAgIHBhc3NDb25kaXRpb246ICh1c2VyOiBVc2VyKSA9PiBCb29sZWFuLCBuZXh0OiAoKSA9PiB2b2lkKTogUHJvbWlzZTxib29sZWFuPlxue1xuICAgIGNvbnN0IHVzZXIgPSBnZXRVc2VyRnJvbVJlcShyZXEpO1xuICAgIGlmICh1c2VyKVxuICAgIHtcbiAgICAgICAgaWYgKCFwYXNzQ29uZGl0aW9uKHVzZXIpKVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiVXNlciBkb2Vzbid0IHNhdGlzZnkgdGhlIHBhc3MtY29uZGl0aW9uLlwiLCB7IHVzZXIgfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKS5zZW5kKFwiVXNlciBkb2Vzbid0IHNhdGlzZnkgdGhlIHBhc3MtY29uZGl0aW9uLlwiKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAodXNlci51c2VyVHlwZSlcbiAgICAgICAge1xuICAgICAgICAgICAgY2FzZSBcImFkbWluXCI6XG4gICAgICAgICAgICBjYXNlIFwibWVtYmVyXCI6XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgYWRkVG9rZW5Gb3JSZWdpc3RlcmVkVXNlcih1c2VyLnVzZXJOYW1lLCByZXMpOyAvLyByZWZyZXNoIHRoZSB0b2tlblxuICAgICAgICAgICAgICAgICAgICAocmVxIGFzIGFueSkudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkZhaWxlZCB0byBhZGQgdG9rZW4gKHJlZ2lzdGVyZWQgdXNlcilcIiwge2Vycn0sIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAxKS5zZW5kKGBGYWlsZWQgdG8gYWRkIHRva2VuIChlcnJvcjogJHtlcnJ9KWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcImd1ZXN0XCI6XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgYWRkVG9rZW5Gb3JHdWVzdCh1c2VyLCByZXMpOyAvLyByZWZyZXNoIHRoZSB0b2tlblxuICAgICAgICAgICAgICAgICAgICAocmVxIGFzIGFueSkudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkZhaWxlZCB0byBhZGQgdG9rZW4gKGd1ZXN0KVwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDEpLnNlbmQoYEZhaWxlZCB0byBhZGQgdG9rZW4gKGVycm9yOiAke2Vycn0pYCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coYFVua25vd24gdXNlciB0eXBlYCwgeyB1c2VyVHlwZTogdXNlci51c2VyVHlwZSB9LCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKGBVbmtub3duIHVzZXIgdHlwZSA6OiAke3VzZXIudXNlclR5cGV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIERlYnVnVXRpbC5sb2dSYXcoXCJBdXRoZW50aWNhdGlvbiBGYWlsZWRcIiwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgcmVzLnN0YXR1cyg0MDEpLnNlbmQoXCJBdXRoZW50aWNhdGlvbiBGYWlsZWRcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8vIFJldHVybnMgTlVMTCBpZiB0aGUgdG9rZW4gZXhpc3RzIGJ1dCB0aGUgYXV0aGVudGljYXRpb24gZmFpbGVkLlxuLy8gUmV0dXJucyBhIHJlZ2lzdGVyZWQgdXNlciAoYWRtaW4gb3IgbWVtYmVyKSBpZiB0aGUgdG9rZW4gZXhpc3RzIGFuZCB0aGUgYXV0aGVudGljYXRpb24gc3VjY2VlZGVkLlxuLy8gUmV0dXJucyBhIGd1ZXN0IHVzZXIgaWYgdGhlIHRva2VuIGRvZXNuJ3QgZXhpc3QuXG5mdW5jdGlvbiBnZXRVc2VyRnJvbVJlcShyZXE6IFJlcXVlc3QpOiBVc2VyIHwgbnVsbFxue1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXNbXCJ0aGluZ3Nwb29sX3Rva2VuXCJdO1xuICAgIGlmICh0b2tlbikgLy8gVG9rZW4gZXhpc3RzPyBJdCBtZWFucyB0aGUgY2xpZW50IGhhcyBhdXRoZW50aWNhdGVkIGJlZm9yZS5cbiAgICB7XG4gICAgICAgIC8vIElmIHRoZSB0b2tlbiBpcyB2YWxpZCBhbmQgbm90IGV4cGlyZWQsIHRoZSBleGlzdGluZyB1c2VyIChtZW1iZXIpIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAgICAgIC8vIE90aGVyd2lzZSBOVUxMIHdpbGwgYmUgcmV0dXJuZWQsIGluIHdoaWNoIGNhc2UgdGhlIGNsaWVudCBzaG91bGQgYmUgYXNrZWQgdG8gcmUtYXV0aGVudGljYXRlIChpLmUuIGxvZyBpbikuXG4gICAgICAgIHJldHVybiBnZXRVc2VyRnJvbVRva2VuKHRva2VuIGFzIHN0cmluZyk7XG4gICAgfVxuICAgIGVsc2UgLy8gVG9rZW4gZG9lc24ndCBleGlzdD8gSXQgbWVhbnMgdGhlIGNsaWVudCBpcyB2aXNpdGluZyB0aGlzIHdlYi1hcHAgdGhlIHZlcnkgZmlyc3QgdGltZS5cbiAgICB7XG4gICAgICAgIC8vIFNpbmNlIHRoaXMgaXMgdGhlIGZpcnN0LXRpbWUgdmlzaXQsIGp1c3QgZ2VuZXJhdGUgYSByYW5kb20gdXNlciBhbmQgbWFrZSBhIGd1ZXN0LXRva2VuIGZvciBpdC5cbiAgICAgICAgLy8gV2Ugd2lsbCBrZWVwIHVzaW5nIHRoaXMgZ3Vlc3QtdG9rZW4gdW50aWwgdGhlIGNsaWVudCBjcmVhdGVzIGhpcy9oZXIgb3duIGFjY291bnQuXG5cbiAgICAgICAgY29uc3QgdW5pcXVlSW50ID0gKChNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSAtIDE3NTc4MDAwMDApICogMTApICsgY3ljbGljQ291bnRlcjtcbiAgICAgICAgY3ljbGljQ291bnRlciA9IChjeWNsaWNDb3VudGVyICsgMSkgJSAxMDtcbiAgICAgICAgY29uc3QgdW5pcXVlSGV4ID0gdW5pcXVlSW50LnRvU3RyaW5nKDE2KTtcbiAgICAgICAgY29uc3QgZ3Vlc3ROYW1lID0gYEd1ZXN0LSR7dW5pcXVlSGV4fWA7XG4gICAgICAgIHJldHVybiB7IHVzZXJJRDogXCIwXCIsIHVzZXJOYW1lOiBndWVzdE5hbWUsIHVzZXJUeXBlOiBcImd1ZXN0XCIsIHBhc3N3b3JkSGFzaDogXCJOT19QQVNTV09SRFwiLCBlbWFpbDogXCJOT19FTUFJTFwiIH07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRVc2VyRnJvbVRva2VuKHRva2VuOiBzdHJpbmcpOiBVc2VyIHwgbnVsbFxue1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBqd3QudmVyaWZ5KHRva2VuIGFzIHN0cmluZywgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVF9LRVkgYXMgc3RyaW5nKTtcbiAgICAgICAgaWYgKHVzZXIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJldHVybiB1c2VyIGFzIFVzZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiVXNlciBpcyBub3QgZm91bmQgaW4gdGhlIGdpdmVuIHRva2VuLlwiLCB7IHRva2VuTGVuZ3RoOiAodG9rZW4gYXMgc3RyaW5nKS5sZW5ndGggfSwgXCJoaWdoXCIsIFwieWVsbG93XCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiVG9rZW4gVmVyaWZpY2F0aW9uIEZhaWxlZFwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhZGRUb2tlbkZvckd1ZXN0KGd1ZXN0VXNlcjogVXNlciwgcmVzPzogUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+XG57XG4gICAgY29uc3QgdG9rZW4gPSBqd3Quc2lnbihcbiAgICAgICAgZ3Vlc3RVc2VyLFxuICAgICAgICBwcm9jZXNzLmVudi5KV1RfU0VDUkVUX0tFWSBhcyBzdHJpbmcsXG4gICAgKTtcblxuICAgIHJlcz8uY29va2llKFwidGhpbmdzcG9vbF90b2tlblwiLCB0b2tlbiwge1xuICAgICAgICBzZWN1cmU6IGRldiA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgIHNhbWVTaXRlOiBcInN0cmljdFwiLFxuICAgICAgICBtYXhBZ2U6IDMxNTU2OTI2MDAwMDAsIC8vIDEwMCB5ZWFyc1xuICAgIH0pLnN0YXR1cygyMDEpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhZGRUb2tlbkZvclJlZ2lzdGVyZWRVc2VyKHVzZXJOYW1lOiBzdHJpbmcsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPlxue1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBmaW5kRXhpc3RpbmdVc2VyQnlVc2VyTmFtZSh1c2VyTmFtZSwgcmVzKTsgLy8gUmUtZmV0Y2ggdGhlIHVzZXIgb2JqZWN0IChiZWNhdXNlIGl0IGNvdWxkJ3ZlIGJlZW4gbW9kaWZpZWQpXG4gICAgaWYgKCF1c2VyKVxuICAgIHtcbiAgICAgICAgRGVidWdVdGlsLmxvZyhcIkZhaWxlZCB0byBhZGQgdG9rZW4gKHVzZXIgbm90IGZvdW5kKVwiLCB7dXNlck5hbWV9LCBcImhpZ2hcIik7XG4gICAgICAgIHJlcz8uc3RhdHVzKDQwNCkuc2VuZChgVHJpZWQgdG8gYWRkIHRva2VuLCBidXQgdGhlcmUgaXMgbm8gYWNjb3VudCB3aXRoIHVzZXJOYW1lIFwiJHt1c2VyTmFtZX1cIi5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRva2VuID0gand0LnNpZ24oXG4gICAgICAgIHVzZXIsXG4gICAgICAgIHByb2Nlc3MuZW52LkpXVF9TRUNSRVRfS0VZIGFzIHN0cmluZyxcbiAgICApO1xuXG4gICAgcmVzPy5jb29raWUoXCJ0aGluZ3Nwb29sX3Rva2VuXCIsIHRva2VuLCB7XG4gICAgICAgIHNlY3VyZTogZGV2ID8gZmFsc2UgOiB0cnVlLFxuICAgICAgICBodHRwT25seTogdHJ1ZSxcbiAgICAgICAgc2FtZVNpdGU6IFwic3RyaWN0XCIsXG4gICAgICAgIG1heEFnZTogMzE1NTY5MjYwMDAwMCwgLy8gMTAwIHllYXJzXG4gICAgfSkuc3RhdHVzKDIwMSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRFeGlzdGluZ1VzZXJCeVVzZXJOYW1lKHVzZXJOYW1lOiBzdHJpbmcsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxhbnk+XG57XG4gICAgbGV0IGV4aXN0aW5nVXNlcnMgPSBhd2FpdCBTZWFyY2hEQi51c2Vycy53aXRoVXNlck5hbWUodXNlck5hbWUsIHJlcyk7XG4gICAgaWYgKHJlcyAmJiAocmVzLnN0YXR1c0NvZGUgPCAyMDAgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSlcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFleGlzdGluZ1VzZXJzIHx8IGV4aXN0aW5nVXNlcnMubGVuZ3RoID09IDApXG4gICAge1xuICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiVXNlciBOb3QgRm91bmRcIiwge3VzZXJOYW1lfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgcmVzPy5jbGVhckNvb2tpZShcInRoaW5nc3Bvb2xfdG9rZW5cIilcbiAgICAgICAgICAgIC5zdGF0dXMoNDA0KVxuICAgICAgICAgICAgLnNlbmQoYFRoZXJlIGlzIG5vIGFjY291bnQgd2l0aCB1c2VyTmFtZSBcIiR7dXNlck5hbWV9XCIuYCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZXhpc3RpbmdVc2Vyc1swXTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVVc2VyTmFtZUFuZFBhc3N3b3JkKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSk6IGJvb2xlYW5cbntcbiAgICBjb25zdCB1c2VyTmFtZUVycm9yID0gVGV4dFV0aWwuZmluZEVycm9ySW5Vc2VyTmFtZShyZXEuYm9keS51c2VyTmFtZSk7XG4gICAgaWYgKHVzZXJOYW1lRXJyb3IgIT0gbnVsbClcbiAgICB7XG4gICAgICAgIERlYnVnVXRpbC5sb2coXCJVc2VyTmFtZSBJbnB1dCBFcnJvclwiLCB7dXNlck5hbWU6IHJlcS5ib2R5LnVzZXJOYW1lLCB1c2VyTmFtZUVycm9yfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgcmVzLnN0YXR1cyg0MDApLnNlbmQoVUlDb25maWcuZGlzcGxheVRleHQubWVzc2FnZVt1c2VyTmFtZUVycm9yXSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgcGFzc3dvcmRFcnJvciA9IFRleHRVdGlsLmZpbmRFcnJvckluUGFzc3dvcmQocmVxLmJvZHkucGFzc3dvcmQpO1xuICAgIGlmIChwYXNzd29yZEVycm9yICE9IG51bGwpXG4gICAge1xuICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiUGFzc3dvcmQgSW5wdXQgRXJyb3JcIiwge3Bhc3N3b3JkOiAoZGV2ID8gcmVxLmJvZHkucGFzc3dvcmQgOiBcIihISURERU4pXCIpLCBwYXNzd29yZEVycm9yfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgcmVzLnN0YXR1cyg0MDApLnNlbmQoVUlDb25maWcuZGlzcGxheVRleHQubWVzc2FnZVtwYXNzd29yZEVycm9yXSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBkZWZhdWx0IEF1dGhVdGlsOyIsImltcG9ydCBDb25zb2xlU29ja2V0cyBmcm9tIFwiLi4vc29ja2V0cy9jb25zb2xlU29ja2V0c1wiO1xuXG5jb25zdCBzdGFja1RyYWNlOiBzdHJpbmdbXSA9IFtdO1xuXG5jb25zdCBEZWJ1Z1V0aWwgPVxue1xuICAgIHRocmVzaG9sZExvZ0xldmVsOiAwLCAvLyAwID0gbG93IGltcG9ydGFuY2UsIDEgPSBtZWRpdW0gaW1wb3J0YW5jZSwgMiA9IGhpZ2ggaW1wb3J0YW5jZVxuICAgIHNldFRocmVzaG9sZExvZ0xldmVsOiAobG9nTGV2ZWxPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQgPT5cbiAgICB7XG4gICAgICAgIERlYnVnVXRpbC50aHJlc2hvbGRMb2dMZXZlbCA9IGlzTmFOKGxvZ0xldmVsT3JOYW1lIGFzIG51bWJlcikgP1xuICAgICAgICAgICAgRGVidWdVdGlsLmdldExvZ0xldmVsRnJvbU5hbWUobG9nTGV2ZWxPck5hbWUgYXMgc3RyaW5nKSA6IChsb2dMZXZlbE9yTmFtZSBhcyBudW1iZXIpO1xuICAgIH0sXG4gICAgZ2V0VGhyZXNob2xkTG9nTGV2ZWw6ICgpOiBudW1iZXIgPT5cbiAgICB7XG4gICAgICAgIHJldHVybiBEZWJ1Z1V0aWwudGhyZXNob2xkTG9nTGV2ZWw7XG4gICAgfSxcbiAgICBnZXRMb2dMZXZlbEZyb21OYW1lOiAobG9nTGV2ZWxOYW1lOiBzdHJpbmcpOiBudW1iZXIgPT4gLy8gXCJsb3dcIiBmb3IgMCwgXCJtZWRpdW1cIiBmb3IgMSwgXCJoaWdoXCIgZm9yIDJcbiAgICB7XG4gICAgICAgIHN3aXRjaCAobG9nTGV2ZWxOYW1lKVxuICAgICAgICB7XG4gICAgICAgICAgICBjYXNlIFwibG93XCI6IHJldHVybiAwO1xuICAgICAgICAgICAgY2FzZSBcIm1lZGl1bVwiOiByZXR1cm4gMTtcbiAgICAgICAgICAgIGNhc2UgXCJoaWdoXCI6IHJldHVybiAyO1xuICAgICAgICAgICAgZGVmYXVsdDogY29uc29sZS5lcnJvcihgRVJST1I6IFVua25vd24gbG9nIGxldmVsIG5hbWUgKFwiJHtsb2dMZXZlbE5hbWV9XCIpYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcbiAgICBsb2c6IChldmVudFRpdGxlOiBzdHJpbmcsIGV2ZW50RGVzY09iajogYW55ID0gdW5kZWZpbmVkLCBsb2dMZXZlbE5hbWU6IHN0cmluZyA9IFwiaGlnaFwiLCBoaWdobGlnaHRDb2xvcj86IHN0cmluZyk6IHZvaWQgPT5cbiAgICB7XG4gICAgICAgIGxldCBkZXRhaWxzID0gXCJcIjtcbiAgICAgICAgaWYgKGV2ZW50RGVzY09iaiAhPSB1bmRlZmluZWQpXG4gICAgICAgICAgICBkZXRhaWxzID0gSlNPTi5zdHJpbmdpZnkoZXZlbnREZXNjT2JqKTtcbiAgICAgICAgY29uc3Qgb3JpZ2luID0gRGVidWdVdGlsLmdldFN0YWNrVHJhY2UoKTtcblxuICAgICAgICBjb25zdCBsb2dMZXZlbCA9IERlYnVnVXRpbC5nZXRMb2dMZXZlbEZyb21OYW1lKGxvZ0xldmVsTmFtZSk7XG4gICAgICAgIGlmIChsb2dMZXZlbCA+PSBEZWJ1Z1V0aWwudGhyZXNob2xkTG9nTGV2ZWwpXG4gICAgICAgICAgICBDb25zb2xlU29ja2V0cy5sb2coKGhpZ2hsaWdodENvbG9yID8gYDxiIHN0eWxlPVwiY29sb3I6JHtoaWdobGlnaHRDb2xvcn1cIj5gIDogXCJcIikgKyBldmVudFRpdGxlICsgKGhpZ2hsaWdodENvbG9yID8gXCI8L2I+XCIgOiBcIlwiKSwgb3JpZ2luLCBkZXRhaWxzKTtcbiAgICB9LFxuICAgIGxvZ1JhdzogKG1lc3NhZ2U6IHN0cmluZywgbG9nTGV2ZWxOYW1lOiBzdHJpbmcgPSBcImhpZ2hcIiwgaGlnaGxpZ2h0Q29sb3I/OiBzdHJpbmcpOiB2b2lkID0+XG4gICAge1xuICAgICAgICBEZWJ1Z1V0aWwubG9nKG1lc3NhZ2UsIHVuZGVmaW5lZCwgbG9nTGV2ZWxOYW1lLCBoaWdobGlnaHRDb2xvcik7XG4gICAgfSxcbiAgICBnZXRTdGFja1RyYWNlOiAoKTogc3RyaW5nID0+XG4gICAge1xuICAgICAgICBjb25zdCBhcnI6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFja1RyYWNlLmxlbmd0aC0xOyBpID49IDA7IC0taSlcbiAgICAgICAgICAgIGFyci5wdXNoKHN0YWNrVHJhY2VbaV0pO1xuICAgICAgICByZXR1cm4gYXJyLmpvaW4oXCIgPC0gXCIpO1xuICAgIH0sXG4gICAgcHVzaFN0YWNrVHJhY2U6ICh0cmFjZU5hbWU6IHN0cmluZyk6IHZvaWQgPT5cbiAgICB7XG4gICAgICAgIHN0YWNrVHJhY2UucHVzaCh0cmFjZU5hbWUpO1xuICAgICAgICBEZWJ1Z1V0aWwubG9nUmF3KGBwdXNoU3RhY2tUcmFjZTogJHt0cmFjZU5hbWV9YCwgXCJoaWdoXCIsIFwiZ3JheVwiKTtcbiAgICB9LFxuICAgIHBvcFN0YWNrVHJhY2U6ICh0cmFjZU5hbWU6IHN0cmluZyk6IHZvaWQgPT5cbiAgICB7XG4gICAgICAgIGlmIChzdGFja1RyYWNlLmxlbmd0aCA9PSAwKVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nUmF3KGBObyBuYW1lIHRvIHBvcCBpbiBzdGFja1RyYWNlIDo6ICh0cmFjZU5hbWUgPSAke3RyYWNlTmFtZX0pYCwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBleHBlY3RlZFRyYWNlTmFtZSA9IHN0YWNrVHJhY2UucG9wKCk7XG4gICAgICAgIGlmIChleHBlY3RlZFRyYWNlTmFtZSAhPSB0cmFjZU5hbWUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIERlYnVnVXRpbC5sb2dSYXcoYE5hbWUgbWlzbWF0Y2ggaW4gc3RhY2tUcmFjZSA6OiAodHJhY2VOYW1lID0gJHt0cmFjZU5hbWV9LCBleHBlY3RlZFRyYWNlTmFtZSA9ICR7ZXhwZWN0ZWRUcmFjZU5hbWV9KWAsIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgRGVidWdVdGlsLmxvZ1JhdyhgcG9wU3RhY2tUcmFjZTogJHt0cmFjZU5hbWV9YCwgXCJoaWdoXCIsIFwiZ3JheVwiKTtcbiAgICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWJ1Z1V0aWw7IiwiaW1wb3J0IERlYnVnVXRpbCBmcm9tIFwiLi9kZWJ1Z1V0aWxcIjtcbmltcG9ydCBGaWxlVXRpbCBmcm9tIFwiLi9maWxlVXRpbFwiO1xuaW1wb3J0IFVJQ29uZmlnIGZyb20gXCIuLi8uLi9zaGFyZWQvZW1iZWRkZWRTY3JpcHRzL2NvbmZpZy91aUNvbmZpZ1wiO1xuaW1wb3J0IFRleHRVdGlsIGZyb20gXCIuLi8uLi9zaGFyZWQvZW1iZWRkZWRTY3JpcHRzL3V0aWwvdGV4dFV0aWxcIjtcbmltcG9ydCBlanMgZnJvbSBcImVqc1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IGVqc1BhcnRpYWxSb290UGF0aCA9IGAke3Byb2Nlc3MuZW52LlBXRH0vJHtwcm9jZXNzLmVudi5WSUVXU19ST09UX0RJUn0vcGFydGlhbGA7XG5cbmNvbnN0IGJhc2VTdGF0aWNQYWdlRUpTUGFyYW1zID0ge1xuICAgIFRleHRVdGlsLCBVSUNvbmZpZyxcbiAgICBlanNQYXJ0aWFsUm9vdFBhdGgsXG4gICAgaXNTdGF0aWNQYWdlOiB0cnVlLFxufTtcbmNvbnN0IGJhc2VEeW5hbWljUGFnZUVKU1BhcmFtcyA9IHtcbiAgICBUZXh0VXRpbCwgVUlDb25maWcsXG4gICAgZWpzUGFydGlhbFJvb3RQYXRoLFxuICAgIGlzU3RhdGljUGFnZTogZmFsc2UsXG59O1xuXG5jb25zdCBjYWNoZWRFSlNTdHJpbmdzOiB7W3JlbGF0aXZlRUpTRmlsZVBhdGg6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuY29uc3QgRUpTVXRpbCA9XG57XG4gICAgcmVuZGVyOiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBlanNWaWV3UGF0aDogc3RyaW5nLFxuICAgICAgICBjdXN0b21FSlNQYXJhbXM6IHtba2V5OiBzdHJpbmddOiBhbnl9KTogdm9pZCA9PlxuICAgIHtcbiAgICAgICAgcmVzLnJlbmRlcihlanNWaWV3UGF0aCwgRUpTVXRpbC5tYWtlRUpTUGFyYW1zKHJlcSwgY3VzdG9tRUpTUGFyYW1zKSwgKGVycjogRXJyb3IsIGh0bWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuc2VuZChlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaHRtbCA9IEVKU1V0aWwucG9zdFByb2Nlc3NIVE1MKGh0bWwpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS5zZXRIZWFkZXIoXCJjb250ZW50LXR5cGVcIiwgXCJ0ZXh0L2h0bWxcIikuc2VuZChodG1sKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBwb3N0UHJvY2Vzc0hUTUw6IChodG1sOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTU9ERSA9PSBcImRldlwiKVxuICAgICAgICB7XG4gICAgICAgICAgICBodG1sID0gaHRtbFxuICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKFwiXFxuXCIsIFwiISpORVdfTElORSohXCIpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoLyhQUk9EX0NPREVfQkVHSU4pLio/KFBST0RfQ09ERV9FTkQpL2csIFwiUkVNT1ZFRF9QUk9EX0NPREVcIilcbiAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChcIiEqTkVXX0xJTkUqIVwiLCBcIlxcblwiKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKHByb2Nlc3MuZW52LlVSTF9TVEFUSUMgYXMgc3RyaW5nLCBgaHR0cDovL2xvY2FsaG9zdDoke3Byb2Nlc3MuZW52LlBPUlR9YCkgLy8gSW4gZGV2IG1vZGUsIHRoZSBkeW5hbWljIHNlcnZlciB3aWxsIGFsc28gcGxheSB0aGUgcm9sZSBvZiB0aGUgc3RhdGljIHNlcnZlciBzaW11bHRhbmVvdXNseS5cbiAgICAgICAgICAgICAgICAucmVwbGFjZUFsbChwcm9jZXNzLmVudi5VUkxfRFlOQU1JQyBhcyBzdHJpbmcsIGBodHRwOi8vbG9jYWxob3N0OiR7cHJvY2Vzcy5lbnYuUE9SVH1gKTtcbiAgICAgICAgICAgIHJldHVybiBodG1sO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgcmV0dXJuIGh0bWw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG1ha2VFSlNQYXJhbXM6IChyZXE6IFJlcXVlc3QsIGN1c3RvbUVKU1BhcmFtczoge1trZXk6IHN0cmluZ106IGFueX0pOiB7W2tleTogc3RyaW5nXTogYW55fSA9PlxuICAgIHtcbiAgICAgICAgY29uc3QgbWVyZ2VkRUpTUGFyYW1zOiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICAgICAgICBPYmplY3QuYXNzaWduKG1lcmdlZEVKU1BhcmFtcywgYmFzZUR5bmFtaWNQYWdlRUpTUGFyYW1zKTtcbiAgICAgICAgT2JqZWN0LmFzc2lnbihtZXJnZWRFSlNQYXJhbXMsIGN1c3RvbUVKU1BhcmFtcyk7XG5cbiAgICAgICAgaWYgKG1lcmdlZEVKU1BhcmFtcy51c2VyKVxuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIid1c2VyJyBzaG91bGRuJ3QgYmUgZGVmaW5lZCBtYW51YWxseSBpbiBFSlMgcGFyYW1zLlwiLCB7bWVyZ2VkRUpTUGFyYW1zfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgbWVyZ2VkRUpTUGFyYW1zLnVzZXIgPSAocmVxIGFzIGFueSkudXNlcjtcblxuICAgICAgICBpZiAobWVyZ2VkRUpTUGFyYW1zLmdsb2JhbERpY3Rpb25hcnkpXG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiJ2dsb2JhbERpY3Rpb25hcnknIHNob3VsZG4ndCBiZSBkZWZpbmVkIG1hbnVhbGx5IGluIEVKUyBwYXJhbXMuXCIsIHttZXJnZWRFSlNQYXJhbXN9LCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICBtZXJnZWRFSlNQYXJhbXMuZ2xvYmFsRGljdGlvbmFyeSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIG1lcmdlZEVKU1BhcmFtcztcbiAgICB9LFxuICAgIG1ha2VFSlNQYXJhbXNTdGF0aWM6IChjdXN0b21FSlNQYXJhbXM6IHtba2V5OiBzdHJpbmddOiBhbnl9KToge1trZXk6IHN0cmluZ106IGFueX0gPT5cbiAgICB7XG4gICAgICAgIGNvbnN0IG1lcmdlZEVKU1BhcmFtcyA9IHt9O1xuICAgICAgICBPYmplY3QuYXNzaWduKG1lcmdlZEVKU1BhcmFtcywgYmFzZVN0YXRpY1BhZ2VFSlNQYXJhbXMpO1xuICAgICAgICBPYmplY3QuYXNzaWduKG1lcmdlZEVKU1BhcmFtcywgY3VzdG9tRUpTUGFyYW1zKTtcbiAgICAgICAgcmV0dXJuIG1lcmdlZEVKU1BhcmFtcztcbiAgICB9LFxuICAgIGNyZWF0ZVN0YXRpY0hUTUxGcm9tRUpTOiBhc3luYyAocmVsYXRpdmVFSlNGaWxlUGF0aDogc3RyaW5nLFxuICAgICAgICBjdXN0b21FSlNQYXJhbXM6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge30pOiBQcm9taXNlPHN0cmluZz4gPT5cbiAgICB7XG4gICAgICAgIGxldCBlanNTdHJpbmcgPSBjYWNoZWRFSlNTdHJpbmdzW3JlbGF0aXZlRUpTRmlsZVBhdGhdO1xuICAgICAgICBpZiAoZWpzU3RyaW5nID09IHVuZGVmaW5lZClcbiAgICAgICAge1xuICAgICAgICAgICAgZWpzU3RyaW5nID0gYXdhaXQgRmlsZVV0aWwucmVhZChyZWxhdGl2ZUVKU0ZpbGVQYXRoLCBwcm9jZXNzLmVudi5WSUVXU19ST09UX0RJUik7XG4gICAgICAgICAgICBjYWNoZWRFSlNTdHJpbmdzW3JlbGF0aXZlRUpTRmlsZVBhdGhdID0gZWpzU3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBlanMuY29tcGlsZShlanNTdHJpbmcpO1xuICAgICAgICBjb25zdCBodG1sU3RyaW5nID0gdGVtcGxhdGUoRUpTVXRpbC5tYWtlRUpTUGFyYW1zU3RhdGljKGN1c3RvbUVKU1BhcmFtcykpO1xuICAgICAgICByZXR1cm4gaHRtbFN0cmluZztcbiAgICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBFSlNVdGlsOyIsImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSBcIm5vZGVtYWlsZXJcIjtcbmltcG9ydCBFbWFpbERCIGZyb20gXCIuLi9kYi9lbWFpbERCXCI7XG5pbXBvcnQgVGV4dFV0aWwgZnJvbSBcIi4uLy4uL3NoYXJlZC9lbWJlZGRlZFNjcmlwdHMvdXRpbC90ZXh0VXRpbFwiO1xuaW1wb3J0IERlYnVnVXRpbCBmcm9tIFwiLi9kZWJ1Z1V0aWxcIjtcbmltcG9ydCBHbG9iYWxDb25maWcgZnJvbSBcIi4uLy4uL3NoYXJlZC9lbWJlZGRlZFNjcmlwdHMvY29uZmlnL2dsb2JhbENvbmZpZ1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgVUlDb25maWcgZnJvbSBcIi4uLy4uL3NoYXJlZC9lbWJlZGRlZFNjcmlwdHMvY29uZmlnL3VpQ29uZmlnXCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmNvbnN0IGNvZGVDaGFycyA9IFwiMDEyMzQ1Njc4OVwiO1xuXG5jb25zdCBFbWFpbFV0aWwgPVxue1xuICAgIHN0YXJ0RW1haWxWZXJpZmljYXRpb246IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+ID0+XG4gICAge1xuICAgICAgICB0cnlcbiAgICAgICAge1xuICAgICAgICAgICAgYXdhaXQgRW1haWxEQi52ZXJpZmljYXRpb25zLmRlbGV0ZUV4cGlyZWQoTWF0aC5mbG9vcihEYXRlLm5vdygpICogMC4wMDEpLCByZXMpO1xuICAgICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlIDwgMjAwIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMClcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IGVtYWlsRXJyb3IgPSBUZXh0VXRpbC5maW5kRXJyb3JJbkVtYWlsQWRkcmVzcyhyZXEuYm9keS5lbWFpbCk7XG4gICAgICAgICAgICBpZiAoZW1haWxFcnJvciAhPSBudWxsKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJFbWFpbCBJbnB1dCBFcnJvclwiLCB7ZW1haWw6IHJlcS5ib2R5LmVtYWlsLCBlbWFpbEVycm9yfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDQwMCkuc2VuZChVSUNvbmZpZy5kaXNwbGF5VGV4dC5tZXNzYWdlW2VtYWlsRXJyb3JdKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nViA9IGF3YWl0IEVtYWlsREIudmVyaWZpY2F0aW9ucy5zZWxlY3RCeUVtYWlsKHJlcS5ib2R5LmVtYWlsLCByZXMpO1xuICAgICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlIDwgMjAwIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdWICYmIGV4aXN0aW5nVi5sZW5ndGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJFbWFpbCBpcyBhbHJlYWR5IHVuZGVyZ29pbmcgdmVyaWZpY2F0aW9uXCIsIHtlbWFpbDogcmVxLmJvZHkuZW1haWx9LCBcImhpZ2hcIiwgXCJwaW5rXCIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKS5zZW5kKGBFbWFpbCBcIiR7cmVxLmJvZHkuZW1haWx9XCIgaXMgYWxyZWFkeSB1bmRlcmdvaW5nIHZlcmlmaWNhdGlvbi5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbkNvZGUgPSBuZXcgQXJyYXkoOClcbiAgICAgICAgICAgICAgICAuZmlsbChudWxsKVxuICAgICAgICAgICAgICAgIC5tYXAoKCkgPT4gY29kZUNoYXJzLmNoYXJBdChjcnlwdG8ucmFuZG9tSW50KGNvZGVDaGFycy5sZW5ndGgpKSlcbiAgICAgICAgICAgICAgICAuam9pbihcIlwiKTtcblxuICAgICAgICAgICAgYXdhaXQgRW1haWxEQi52ZXJpZmljYXRpb25zLmluc2VydChcbiAgICAgICAgICAgICAgICByZXEuYm9keS5lbWFpbCxcbiAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25Db2RlLFxuICAgICAgICAgICAgICAgIE1hdGguZmxvb3IoRGF0ZS5ub3coKSAqIDAuMDAxKSArIEdsb2JhbENvbmZpZy5hdXRoLmVtYWlsVmVyaWZpY2F0aW9uVGltZW91dEluU2Vjb25kcyxcbiAgICAgICAgICAgICAgICByZXNcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAocmVzLnN0YXR1c0NvZGUgPCAyMDAgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgaWYgKEdsb2JhbENvbmZpZy5hdXRoLmJ5cGFzc0VtYWlsVmVyaWZpY2F0aW9uKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJFbWFpbCB0cmFuc21pc3Npb24gYnlwYXNzZWRcIiwge2VtYWlsOiByZXEuYm9keS5lbWFpbH0sIFwibG93XCIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoMjAxKS5zZW5kKHZlcmlmaWNhdGlvbkNvZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRyYW5zcG9ydGVyID0gbm9kZW1haWxlci5jcmVhdGVUcmFuc3BvcnQoe1xuICAgICAgICAgICAgICAgICAgICBzZXJ2aWNlOiBcIm5hdmVyXCIsXG4gICAgICAgICAgICAgICAgICAgIGhvc3Q6IFwic210cC5uYXZlci5jb21cIixcbiAgICAgICAgICAgICAgICAgICAgYXV0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcjogXCJwaW5rcm9vbTc3QG5hdmVyLmNvbVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFzczogcHJvY2Vzcy5lbnYuRU1BSUxfU0VOREVSX1BBU1MsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtYWlsT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbTogXCJwaW5rcm9vbTc3QG5hdmVyLmNvbVwiLFxuICAgICAgICAgICAgICAgICAgICB0bzogcmVxLmJvZHkuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIHN1YmplY3Q6IFwiSGVyZSBpcyB5b3VyIGVtYWlsIHZlcmlmaWNhdGlvbiBjb2RlLlwiLFxuICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgWW91ciB2ZXJpZmljYXRpb24gY29kZSBpcyAke3ZlcmlmaWNhdGlvbkNvZGV9YCxcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2VuZFJlc3VsdCA9IGF3YWl0IHRyYW5zcG9ydGVyLnNlbmRNYWlsKG1haWxPcHRpb25zKTtcbiAgICAgICAgICAgICAgICB0cmFuc3BvcnRlci5jbG9zZSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNlbmRSZXN1bHQuYWNjZXB0ZWQpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiRW1haWwgc2VudFwiLCB7ZW1haWw6IHJlcS5ib2R5LmVtYWlsfSwgXCJsb3dcIik7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZW5kU3RhdHVzKDIwMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJFbWFpbCBmYWlsZWQgdG8gYmUgc2VudFwiLCB7ZW1haWw6IHJlcS5ib2R5LmVtYWlsfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRW1haWxEQi52ZXJpZmljYXRpb25zLnVwZGF0ZUV4cGlyYXRpb25UaW1lKFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxLmJvZHkuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmZsb29yKERhdGUubm93KCkgKiAwLjAwMSkgKyAxMjAsIC8vIGJsb2NrIHJldHJ5IGZvciAyIG1pbnV0ZXMgKHRvIHByZXZlbnQgc3BhbW1pbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlIDwgMjAwIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuc2VuZChgRXJyb3Igd2hpbGUgc2VuZGluZyB0aGUgdmVyaWZpY2F0aW9uIGNvZGUgdG8gXCIke3JlcS5ib2R5LmVtYWlsfVwiLiBQbGVhc2UgdHJ5IGFnYWluIGFmdGVyIDIgbWludXRlcy5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycilcbiAgICAgICAge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkVtYWlsIFZlcmlmaWNhdGlvbiBTdGFydCBFcnJvclwiLCB7ZXJyfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKGBFUlJPUjogRmFpbGVkIHRvIHN0YXJ0IGVtYWlsIHZlcmlmaWNhdGlvbiAoJHtlcnJ9KS5gKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZW5kRW1haWxWZXJpZmljYXRpb246IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+ID0+XG4gICAge1xuICAgICAgICBjb25zdCBlbWFpbEVycm9yID0gVGV4dFV0aWwuZmluZEVycm9ySW5FbWFpbEFkZHJlc3MocmVxLmJvZHkuZW1haWwpO1xuICAgICAgICBpZiAoZW1haWxFcnJvciAhPSBudWxsKVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKFwiRW1haWwgSW5wdXQgRXJyb3JcIiwge2VtYWlsOiByZXEuYm9keS5lbWFpbCwgZW1haWxFcnJvcn0sIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwMCkuc2VuZChVSUNvbmZpZy5kaXNwbGF5VGV4dC5tZXNzYWdlW2VtYWlsRXJyb3JdKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uQ29kZSA9IHJlcS5ib2R5LnZlcmlmaWNhdGlvbkNvZGUgYXMgc3RyaW5nO1xuXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nViA9IGF3YWl0IEVtYWlsREIudmVyaWZpY2F0aW9ucy5zZWxlY3RCeUVtYWlsKHJlcS5ib2R5LmVtYWlsLCByZXMpO1xuICAgICAgICBpZiAocmVzLnN0YXR1c0NvZGUgPCAyMDAgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAoIWV4aXN0aW5nViB8fCBleGlzdGluZ1YubGVuZ3RoID09IDApXG4gICAgICAgIHtcbiAgICAgICAgICAgIERlYnVnVXRpbC5sb2coXCJObyBwZW5kaW5nIGVtYWlsIHZlcmlmaWNhdGlvbiBmb3VuZFwiLCB7ZW1haWw6IHJlcS5ib2R5LmVtYWlsfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KS5zZW5kKGBObyBwZW5kaW5nIHZlcmlmaWNhdGlvbiBmb3VuZCBmb3IgZW1haWwgXCIke3JlcS5ib2R5LmVtYWlsfVwiLmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleGlzdGluZ1ZbMF0udmVyaWZpY2F0aW9uQ29kZSAhPSB2ZXJpZmljYXRpb25Db2RlKVxuICAgICAgICB7XG4gICAgICAgICAgICBEZWJ1Z1V0aWwubG9nKGBWZXJpZmljYXRpb24gQ29kZSBNaXNtYXRjaCAoY29kZSBlbnRlcmVkID0gJyR7dmVyaWZpY2F0aW9uQ29kZX0nKWAsXG4gICAgICAgICAgICAgICAge2VtYWlsOiByZXEuYm9keS5lbWFpbCwgYWN0dWFsQ29kZTogZXhpc3RpbmdWWzBdLnZlcmlmaWNhdGlvbkNvZGUsIGVudGVyZWRDb2RlOiB2ZXJpZmljYXRpb25Db2RlfSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKS5zZW5kKGBXcm9uZyB2ZXJpZmljYXRpb24gY29kZSBmb3IgZW1haWwgXCIke3JlcS5ib2R5LmVtYWlsfVwiLmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzLnN0YXR1cygyMDIpO1xuICAgIH0sXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVtYWlsVXRpbDsiLCJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGZzIGZyb20gXCJmcy9wcm9taXNlc1wiO1xuaW1wb3J0IERlYnVnVXRpbCBmcm9tIFwiLi9kZWJ1Z1V0aWxcIjtcbmltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuZG90ZW52LmNvbmZpZygpO1xuXG5jb25zdCBGaWxlVXRpbCA9XG57XG4gICAgcmVhZDogYXN5bmMgKHJlbGF0aXZlRmlsZVBhdGg6IHN0cmluZywgcm9vdERpcj86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PlxuICAgIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFic29sdXRlRmlsZVBhdGggPSBGaWxlVXRpbC5nZXRBYnNvbHV0ZUZpbGVQYXRoKHJlbGF0aXZlRmlsZVBhdGgsIHJvb3REaXIpO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhgUmVhZGluZyAtLS0+ICR7YWJzb2x1dGVGaWxlUGF0aH1gKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShhYnNvbHV0ZUZpbGVQYXRoLCB7ZW5jb2Rpbmc6ICd1dGY4J30pO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkZhaWxlZCB0byByZWFkIGZpbGVcIiwge3JlbGF0aXZlRmlsZVBhdGgsIGVycn0sIFwiaGlnaFwiLCBcInBpbmtcIik7XG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgd3JpdGU6IGFzeW5jIChyZWxhdGl2ZUZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgcm9vdERpcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT5cbiAgICB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhYnNvbHV0ZUZpbGVQYXRoID0gRmlsZVV0aWwuZ2V0QWJzb2x1dGVGaWxlUGF0aChyZWxhdGl2ZUZpbGVQYXRoLCByb290RGlyKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coYFdyaXRpbmcgLS0tPiAke2Fic29sdXRlRmlsZVBhdGh9YCk7XG4gICAgICAgICAgICBhd2FpdCBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlUGF0aCwgY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgRGVidWdVdGlsLmxvZyhcIkZhaWxlZCB0byB3cml0ZSBmaWxlXCIsIHtyZWxhdGl2ZUZpbGVQYXRoLCBlcnJ9IGFzIGFueSwgXCJoaWdoXCIsIFwicGlua1wiKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0QWxsUmVsYXRpdmVQYXRoc0luRGlyUmVjdXJzaXZlbHk6IGFzeW5jIChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+ID0+XG4gICAge1xuICAgICAgICBjb25zdCBhYnNvbHV0ZURpclBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUFdEIGFzIHN0cmluZywgZGlyKTtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBhd2FpdCBGaWxlVXRpbC5nZXRBbGxSZWxhdGl2ZVBhdGhzSW5EaXJSZWN1cnNpdmVseV9pbnRlcm5hbChhYnNvbHV0ZURpclBhdGgsIFtdLCByZXN1bHQpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgZ2V0QWJzb2x1dGVGaWxlUGF0aChyZWxhdGl2ZUZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXI/OiBzdHJpbmcpOiBzdHJpbmdcbiAgICB7XG4gICAgICAgIGlmIChyb290RGlyID09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIHJvb3REaXIgPSBwcm9jZXNzLmVudi5TVEFUSUNfUEFHRV9ST09UX0RJUjtcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudi5QV0QgYXMgc3RyaW5nLCByb290RGlyICsgXCIvXCIgKyByZWxhdGl2ZUZpbGVQYXRoKTtcbiAgICB9LFxuICAgIGFzeW5jIGdldEFsbFJlbGF0aXZlUGF0aHNJbkRpclJlY3Vyc2l2ZWx5X2ludGVybmFsKFxuICAgICAgICBhYnNvbHV0ZURpclBhdGg6IHN0cmluZywgc3ViRGlyczogc3RyaW5nW10sIHJlc3VsdDogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+XG4gICAge1xuICAgICAgICBjb25zdCBmaWxlTmFtZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGFic29sdXRlRGlyUGF0aCk7XG4gICAgICAgIGZvciAoY29uc3QgZmlsZU5hbWUgb2YgZmlsZU5hbWVzKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBzdWJEaXJzTmV3ID0gc3ViRGlycy5jb25jYXQoZmlsZU5hbWUpO1xuICAgICAgICAgICAgY29uc3QgYWJzb2x1dGVGaWxlUGF0aCA9IGAke2Fic29sdXRlRGlyUGF0aH0vJHtmaWxlTmFtZX1gO1xuICAgICAgICAgICAgY29uc3QgbHN0YXQgPSBhd2FpdCBmcy5sc3RhdChhYnNvbHV0ZUZpbGVQYXRoKTtcbiAgICAgICAgICAgIGlmIChsc3RhdC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChzdWJEaXJzTmV3LmpvaW4oXCIvXCIpKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBhd2FpdCBGaWxlVXRpbC5nZXRBbGxSZWxhdGl2ZVBhdGhzSW5EaXJSZWN1cnNpdmVseV9pbnRlcm5hbChhYnNvbHV0ZUZpbGVQYXRoLCBzdWJEaXJzTmV3LCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGaWxlVXRpbDsiLCJpbXBvcnQgeyBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcbmRvdGVudi5jb25maWcoKTtcblxuY29uc3QgTmV0d29ya1V0aWwgPVxue1xuICAgIG9uUm91dGVSZXNwb25zZTogKHJlczogUmVzcG9uc2UsIHJlc0pTT046IHtba2V5OiBzdHJpbmddOiBhbnl9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA+PSAyMDAgJiYgcmVzLnN0YXR1c0NvZGUgPD0gMjk5KVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBFbmQgcmVzcG9uc2UgaWYgaXRzIHN0YXR1cyBpcyBPS1xuICAgICAgICAgICAgaWYgKHJlc0pTT04pXG4gICAgICAgICAgICAgICAgcmVzLmpzb24ocmVzSlNPTik7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXRFcnJvclBhZ2VVUkw6IChlcnJvclBhZ2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgcmV0dXJuIGAke3Byb2Nlc3MuZW52Lk1PREUgPT0gXCJkZXZcIiA/IGBodHRwOi8vbG9jYWxob3N0OiR7cHJvY2Vzcy5lbnYuUE9SVH1gIDogcHJvY2Vzcy5lbnYuVVJMX1NUQVRJQ30vZXJyb3IvJHtlcnJvclBhZ2VOYW1lfS5odG1sYDtcbiAgICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrVXRpbDsiLCJjb25zdCBHbG9iYWxDb25maWcgPVxue1xuICAgIGF1dGg6IHtcbiAgICAgICAgYnlwYXNzRW1haWxWZXJpZmljYXRpb246IGZhbHNlLFxuICAgICAgICBlbWFpbFZlcmlmaWNhdGlvblRpbWVvdXRJblNlY29uZHM6IDYwMCxcbiAgICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBHbG9iYWxDb25maWc7IiwiY29uc3QgVUlDb25maWcgPVxue1xuICAgIGRpc3BsYXlUZXh0OiB7XG4gICAgICAgIHBhZ2VOYW1lOiB7XG4gICAgICAgICAgICBcImluZGV4XCI6IFwiSG9tZVwiLCAvLyBzdGF0aWNcbiAgICAgICAgICAgIFwiYXJjYWRlXCI6IFwiQXJjYWRlXCIsIC8vIHN0YXRpY1xuICAgICAgICAgICAgXCJsaWJyYXJ5XCI6IFwiTGlicmFyeVwiLCAvLyBzdGF0aWNcbiAgICAgICAgICAgIFwicG9ydGZvbGlvXCI6IFwiUG9ydGZvbGlvXCIsIC8vIHN0YXRpY1xuICAgICAgICAgICAgXCJyZWdpc3RlclwiOiBcIkNyZWF0ZSBBY2NvdW50XCIsIC8vIGR5bmFtaWNcbiAgICAgICAgICAgIFwibG9naW5cIjogXCJMb2cgSW5cIiwgLy8gZHluYW1pY1xuICAgICAgICAgICAgXCJteXBhZ2VcIjogXCJQb3J0YWxcIiwgLy8gZHluYW1pY1xuICAgICAgICB9LFxuICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICBcImVycm9yL3VzZXJOYW1lL2xlbmd0aFwiOiBcIlVzZXJuYW1lIG11c3QgYmUgYmV0d2VlbiA0IGFuZCAxNiBjaGFyYWN0ZXJzIGxvbmcuXCIsXG4gICAgICAgICAgICBcImVycm9yL3VzZXJOYW1lL2NoYXJzXCI6IFwiVXNlcm5hbWUgY2FuIG9ubHkgY29udGFpbiBhbHBoYWJldHMsIG51bWJlcnMsIGFuZCB1bmRlcmJhcihfKS5cIixcbiAgICAgICAgICAgIFwiZXJyb3IvcGFzc3dvcmQvbGVuZ3RoXCI6IFwiUGFzc3dvcmQgbXVzdCBiZSBiZXR3ZWVuIDYgYW5kIDI0IGNoYXJhY3RlcnMgbG9uZy5cIixcbiAgICAgICAgICAgIFwiZXJyb3IvcGFzc3dvcmQvY2hhcnNcIjogXCJQYXNzd29yZCBjYW4gb25seSBjb250YWluIGFscGhhYmV0cywgbnVtYmVycywgYW5kIHRoZSBmb2xsb3dpbmcgc3BlY2lhbCBjaGFyYWN0ZXJzOiB+YCFAIyQlXiYqKCktXys9e31bXXxcXFxcOjtcXFwiJzw+LC4/L1wiLFxuICAgICAgICAgICAgXCJlcnJvci9lbWFpbC9sZW5ndGhcIjogXCJFbWFpbCBhZGRyZXNzIG11c3Qgbm90IGNvbnRhaW4gbW9yZSB0aGFuIDY0IGNoYXJhY3RlcnMuXCIsXG4gICAgICAgICAgICBcImVycm9yL2VtYWlsL2NoYXJzXCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgZW1haWwgYWRkcmVzcy5cIixcbiAgICAgICAgICAgIFwiZXJyb3Ivcm9vbU5hbWUvbGVuZ3RoXCI6IFwiUm9vbSBuYW1lIG11c3QgYmUgYmV0d2VlbiA0IGFuZCA2NCBjaGFyYWN0ZXJzIGxvbmcuXCIsXG4gICAgICAgICAgICBcImVycm9yL3Jvb21OYW1lL2NoYXJzXCI6IFwiUm9vbSBuYW1lIGNhbiBvbmx5IGNvbnRhaW4gYWxwaGFiZXRzLCBudW1iZXJzLCBzcGFjZXMsIGFuZCB0aGUgZm9sbG93aW5nIHNwZWNpYWwgY2hhcmFjdGVyczogfmAhQCMkJV4mKigpLV8rPXt9W118XFxcXDo7XFxcIic8PiwuPy9cIixcblxuICAgICAgICAgICAgXCJydWxlL3VzZXJOYW1lL2xlbmd0aFwiOiBcIlVzZXJuYW1lIG11c3QgYmUgYmV0d2VlbiA0IGFuZCAxNiBjaGFyYWN0ZXJzIGxvbmcuXCIsXG4gICAgICAgICAgICBcInJ1bGUvdXNlck5hbWUvY2hhcnNcIjogXCJVc2VybmFtZSBjYW4gb25seSBjb250YWluIGFscGhhYmV0cywgbnVtYmVycywgYW5kIHVuZGVyYmFyKF8pLlwiLFxuICAgICAgICAgICAgXCJydWxlL3Bhc3N3b3JkL2xlbmd0aFwiOiBcIlBhc3N3b3JkIG11c3QgYmUgYmV0d2VlbiA2IGFuZCAyNCBjaGFyYWN0ZXJzIGxvbmcuXCIsXG4gICAgICAgICAgICBcInJ1bGUvcGFzc3dvcmQvY2hhcnNcIjogXCJQYXNzd29yZCBjYW4gb25seSBjb250YWluIGFscGhhYmV0cywgbnVtYmVycywgYW5kIHRoZSBmb2xsb3dpbmcgc3BlY2lhbCBjaGFyYWN0ZXJzOiB+YCFAIyQlXiYqKCktXys9e31bXXxcXFxcOjtcXFwiJzw+LC4/L1wiLFxuICAgICAgICAgICAgXCJydWxlL2VtYWlsL2xlbmd0aFwiOiBcIkVtYWlsIGFkZHJlc3MgbXVzdCBub3QgY29udGFpbiBtb3JlIHRoYW4gNjQgY2hhcmFjdGVycy5cIixcbiAgICAgICAgICAgIFwicnVsZS9yb29tTmFtZS9sZW5ndGhcIjogXCJSb29tIG5hbWUgbXVzdCBiZSBiZXR3ZWVuIDQgYW5kIDY0IGNoYXJhY3RlcnMgbG9uZy5cIixcbiAgICAgICAgICAgIFwicnVsZS9yb29tTmFtZS9jaGFyc1wiOiBcIlJvb20gbmFtZSBjYW4gb25seSBjb250YWluIGFscGhhYmV0cywgbnVtYmVycywgc3BhY2VzLCBhbmQgdGhlIGZvbGxvd2luZyBzcGVjaWFsIGNoYXJhY3RlcnM6IH5gIUAjJCVeJiooKS1fKz17fVtdfFxcXFw6O1xcXCInPD4sLj8vXCIsXG4gICAgICAgIH0sXG4gICAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlDb25maWc7IiwiY29uc3QgVGV4dFV0aWwgPVxue1xuICAgIC8vIGNoYXJhY3RlciBlc2NhcGVcblxuICAgIGVzY2FwZUhUTUxDaGFyczogKHRleHQpID0+XG4gICAge1xuICAgICAgICByZXR1cm4gdGV4dFxuICAgICAgICAgICAgLnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKVxuICAgICAgICAgICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCBcIiZxdW90O1wiKVxuICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIilcbiAgICAgICAgICAgIC5yZXBsYWNlQWxsKFwiXFxuXCIsIFwiPGJyPlwiKVxuICAgICAgICAgICAgLnJlcGxhY2VBbGwoXCIgXCIsIFwiJm5ic3A7XCIpO1xuICAgIH0sXG5cbiAgICAvLyBpbnB1dCB2YWxpZGF0aW9uXG5cbiAgICBmaW5kRXJyb3JJblVzZXJOYW1lOiAodGV4dCkgPT5cbiAgICB7XG4gICAgICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDQgfHwgdGV4dC5sZW5ndGggPiAxNilcbiAgICAgICAgICAgIHJldHVybiBcImVycm9yL3VzZXJOYW1lL2xlbmd0aFwiO1xuICAgICAgICBpZiAodGV4dCAhPSBUZXh0VXRpbC5zYW5pdGl6ZVVzZXJOYW1lKHRleHQpKVxuICAgICAgICAgICAgcmV0dXJuIFwiZXJyb3IvdXNlck5hbWUvY2hhcnNcIjtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBmaW5kRXJyb3JJblBhc3N3b3JkOiAodGV4dCkgPT5cbiAgICB7XG4gICAgICAgIGlmICh0ZXh0Lmxlbmd0aCA8IDYgfHwgdGV4dC5sZW5ndGggPiAyNClcbiAgICAgICAgICAgIHJldHVybiBcImVycm9yL3Bhc3N3b3JkL2xlbmd0aFwiO1xuICAgICAgICBpZiAodGV4dCAhPSBUZXh0VXRpbC5zYW5pdGl6ZVBhc3N3b3JkKHRleHQpKVxuICAgICAgICAgICAgcmV0dXJuIFwiZXJyb3IvcGFzc3dvcmQvY2hhcnNcIjtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBmaW5kRXJyb3JJbkVtYWlsQWRkcmVzczogKHRleHQpID0+XG4gICAge1xuICAgICAgICBpZiAodGV4dC5sZW5ndGggPiA2NClcbiAgICAgICAgICAgIHJldHVybiBcImVycm9yL2VtYWlsL2xlbmd0aFwiO1xuICAgICAgICBjb25zdCByZWdleCA9IC9eW15cXHNAXStAW15cXHNAXSsuW15cXHNAXSskLztcbiAgICAgICAgaWYgKCFyZWdleC50ZXN0KHRleHQpKVxuICAgICAgICAgICAgcmV0dXJuIFwiZXJyb3IvZW1haWwvY2hhcnNcIlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGZpbmRFcnJvckluUm9vbU5hbWU6ICh0ZXh0KSA9PlxuICAgIHtcbiAgICAgICAgaWYgKHRleHQubGVuZ3RoIDwgNCB8fCB0ZXh0Lmxlbmd0aCA+IDY0KVxuICAgICAgICAgICAgcmV0dXJuIFwiZXJyb3Ivcm9vbU5hbWUvbGVuZ3RoXCI7XG4gICAgICAgIGlmICh0ZXh0ICE9IFRleHRVdGlsLnNhbml0aXplUm9vbU5hbWUodGV4dCkpXG4gICAgICAgICAgICByZXR1cm4gXCJlcnJvci9yb29tTmFtZS9jaGFyc1wiO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIFxuICAgIHNhbml0aXplVXNlck5hbWU6ICh0ZXh0KSA9PlxuICAgIHtcbiAgICAgICAgaWYgKHRleHQubGVuZ3RoID4gMTYpXG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgMTYpO1xuICAgICAgICByZXR1cm4gdGV4dC5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csIFwiXCIpO1xuICAgIH0sXG4gICAgc2FuaXRpemVQYXNzd29yZDogKHRleHQpID0+XG4gICAge1xuICAgICAgICBpZiAodGV4dC5sZW5ndGggPiAyNClcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCAyNCk7XG4gICAgICAgIHJldHVybiB0ZXh0LnJlcGxhY2UoL1teYS16QS1aMC05fmAhQCNcXCQlXFxeJlxcKlxcKFxcKS1fXFwrPVxce1xcW1xcfVxcXVxcfFxcXFw6O1wiJzw+LFxcLlxcP1xcL10vZywgXCJcIik7XG4gICAgfSxcbiAgICBzYW5pdGl6ZVJvb21OYW1lOiAodGV4dCkgPT5cbiAgICB7XG4gICAgICAgIHJldHVybiBUZXh0VXRpbC5zYW5pdGl6ZVJvb21OYW1lV2l0aG91dFRyaW1taW5nKHRleHQpLnRyaW0oKTtcbiAgICB9LFxuICAgIHNhbml0aXplUm9vbU5hbWVXaXRob3V0VHJpbW1pbmc6ICh0ZXh0KSA9PlxuICAgIHtcbiAgICAgICAgaWYgKHRleHQubGVuZ3RoID4gNjQpXG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgNjQpO1xuICAgICAgICByZXR1cm4gdGV4dC5yZXBsYWNlKC9bXmEtekEtWjAtOX5gIUAjXFwkJVxcXiZcXCpcXChcXCktX1xcKz1cXHtcXFtcXH1cXF1cXHxcXFxcOjtcIic8PixcXC5cXD9cXC9cXHNdL2csIFwiXCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIik7IC8vIHJlcGxhY2UgbXVsdGlwbGUgY29uc2VjdXRpdmUgc3BhY2VzIHdpdGggYSBzaW5nbGUgc3BhY2UuXG4gICAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dFV0aWw7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiYmNyeXB0XCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImJvZHktcGFyc2VyXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImNvb2tpZVwiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJjb29raWUtcGFyc2VyXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImNyeXB0b1wiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJkb3RlbnZcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiZWpzXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImV4cHJlc3NcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiZnMvcHJvbWlzZXNcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiaHBwXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImh0dHBcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwianNvbndlYnRva2VuXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIm15c3FsMi9wcm9taXNlXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIm5vZGVtYWlsZXJcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicGF0aFwiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJzb2NrZXQuaW9cIik7IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSAobW9kdWxlKSA9PiB7XG5cdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuXHRcdCgpID0+IChtb2R1bGVbJ2RlZmF1bHQnXSkgOlxuXHRcdCgpID0+IChtb2R1bGUpO1xuXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQoZ2V0dGVyLCB7IGE6IGdldHRlciB9KTtcblx0cmV0dXJuIGdldHRlcjtcbn07IiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCBleHByZXNzIGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cCBmcm9tIFwiaHR0cFwiO1xuaW1wb3J0IGJvZHlQYXJzZXIgZnJvbSBcImJvZHktcGFyc2VyXCI7XG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XG5pbXBvcnQgaHBwIGZyb20gXCJocHBcIjtcbmltcG9ydCBTU0cgZnJvbSBcIi4vc3NnL3NzZ1wiO1xuaW1wb3J0IERCIGZyb20gXCIuL2RiL2RiXCI7XG5pbXBvcnQgUm91dGVyIGZyb20gXCIuL3JvdXRlci9yb3V0ZXJcIjtcbmltcG9ydCBTb2NrZXRzIGZyb20gXCIuL3NvY2tldHMvc29ja2V0c1wiO1xuaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5kb3RlbnYuY29uZmlnKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIFNlcnZlcigpOiBQcm9taXNlPHZvaWQ+XG57XG4gICAgLy8gU1NHID0gXCJTdGF0aWMgU2l0ZSBHZW5lcmF0b3JcIlxuICAgIGlmIChwcm9jZXNzLmVudi5NT0RFID09IFwiZGV2XCIpIC8vIElmIHlvdSBhcmUgaW4gZGV2IG1vZGUsIHJlYnVpbGQgdGhlIHN0YXRpYyBwYWdlcyBvbiByZXN0YXJ0LlxuICAgIHtcbiAgICAgICAgYXdhaXQgU1NHKCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHByb2Nlc3MuZW52Lk1PREUgPT0gXCJzc2dcIikgLy8gSWYgeW91IGFyZSBpbiBzc2cgbW9kZSwganVzdCByZWJ1aWxkIHRoZSBzdGF0aWMgcGFnZXMgYW5kIHF1aXQgaW1tZWRpYXRlbHkuXG4gICAge1xuICAgICAgICBhd2FpdCBTU0coKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGRhdGFiYXNlIGluaXRpYWxpemF0aW9uXG4gICAgYXdhaXQgREIucnVuU1FMRmlsZShcImNsZWFyLnNxbFwiKTsgLy8gPC0tLSBUT0RPOiBSZW1vdmUgdGhpcyBvbmNlIHRoZSBkYXRhIG1pZ3JhdGlvbiBzeXN0ZW0gZ2V0cyBpbXBsZW1lbnRlZC5cbiAgICBhd2FpdCBEQi5ydW5TUUxGaWxlKFwiaW5pdC5zcWxcIik7XG5cbiAgICAvLyBleHByZXNzIGFwcFxuICAgIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcbiAgICBjb25zdCBzZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcihhcHApO1xuXG4gICAgLy8gY29uZmlnXG4gICAgYXBwLnNldChcInZpZXcgZW5naW5lXCIsIFwiZWpzXCIpO1xuXG4gICAgLy8gbWlkZGxld2FyZVxuICAgIGFwcC51c2UoYm9keVBhcnNlci5qc29uKCkpO1xuICAgIGFwcC51c2UoYm9keVBhcnNlci51cmxlbmNvZGVkKHsgZXh0ZW5kZWQ6IHRydWUgfSkpO1xuICAgIGFwcC51c2UoY29va2llUGFyc2VyKCkpO1xuICAgIGFwcC51c2UoaHBwKCkpOyAvLyBmb3IgSFRUUCBwYXJhbWV0ZXIgcG9sbHV0aW9uIHByZXZlbnRpb25cblxuICAgIC8vIHJvdXRlclxuICAgIFJvdXRlcihhcHApO1xuXG4gICAgLy8gc2VydmVyIGNvbm5lY3Rpb25cbiAgICBzZXJ2ZXIubGlzdGVuKHByb2Nlc3MuZW52LlBPUlQsICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCItLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIik7XG4gICAgICAgIGNvbnNvbGUubG9nKGBMaXN0ZW5pbmcgdG8gcG9ydCAke3Byb2Nlc3MuZW52LlBPUlR9LmApO1xuICAgIH0pO1xuXG4gICAgLy8gc29ja2V0IGNvbm5lY3Rpb25cbiAgICBTb2NrZXRzKHNlcnZlcik7XG59XG5cblNlcnZlcigpOyJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==