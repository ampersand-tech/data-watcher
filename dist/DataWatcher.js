"use strict";
/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataWatcher = exports.comparePropsAndState = exports.init = void 0;
var DataOverlay_1 = require("./DataOverlay");
var amper_promise_utils_1 = require("amper-promise-utils");
var ArrayUtils = require("amper-utils/dist/arrayUtils");
var ObjUtils = require("amper-utils/dist/objUtils");
var dataOverlay_1 = require("data-store/dist/dataOverlay");
var DataServerCmd = require("data-store/dist/dataServerCmd");
var DataStore = require("data-store/dist/dataStore");
var DataStoreWatch = require("data-store/dist/dataStoreWatch");
var React = require("react");
var SafeRaf = require("safe-raf");
var REACT_PRIORITY = 1000;
var SLOW_RENDER_CUTOFF = 50;
var gSvrCmd = null;
var gProxyCmdAndSyncFunc = null;
function init(svrCmdFunc, proxyCmdAndSyncFunc) {
    gSvrCmd = svrCmdFunc;
    gProxyCmdAndSyncFunc = proxyCmdAndSyncFunc;
}
exports.init = init;
function comparePropsAndState(reactClass, props, state) {
    if (!ObjUtils.objCmpFast(reactClass.props, props)) {
        return true;
    }
    if (!ObjUtils.objCmpFast(reactClass.state, state)) {
        return true;
    }
    return false;
}
exports.comparePropsAndState = comparePropsAndState;
function hasChildren(props) {
    if (!props.children) {
        return false;
    }
    if (Array.isArray(props.children) && !props.children.length) {
        return false;
    }
    if (ObjUtils.isObject(props.children) && !Object.keys(props.children).length) {
        return false;
    }
    return true;
}
var DataWatcher = /** @class */ (function (_super) {
    __extends(DataWatcher, _super);
    function DataWatcher() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._hasState = false;
        _this._isMounted = false;
        _this._dataWatcher = null;
        _this._watchingEnabled = true;
        _this._timers = [];
        _this._namedTimers = {};
        _this._rafs = [];
        _this._inRender = false;
        _this._dataChanges = [];
        _this.onDataChange = function (watcher, changes) {
            // make sure we didn't get unmounted during watch triggering
            if (_this._dataWatcher === watcher) {
                _this._dataChanges.push.apply(_this._dataChanges, changes);
                _this.forceUpdate();
            }
        };
        /*
        processAndCollateImages = (images: Stash<File | FileList>, opts: ImageToolsLib.UploadOpts | null, cb: Function) => {
          let processImage = (imgFile: File | FileList, next) => {
            ImageToolsLib.setFileImageGeneralCB(next, imgFile, opts);
          };
      
          const jobs = new Jobs.Parallel();
          for (let key in images) {
            jobs.collate(key, processImage, images[key]);
          }
          jobs.drain((err, results) => {
            if (this._isMounted && !err) {
              cb(results);
            }
          });
        }
      
        setStateImages = (images: Stash<File | FileList>) => this.processAndCollateImages(images, null, this.setState.bind(this));
        */
        _this.svrCmd = function (cmd, params, cb) {
            if (!gSvrCmd) {
                throw new Error('must init datawatcher with a valid svrCmd function!');
            }
            (0, amper_promise_utils_1.withError)(gSvrCmd(cmd, params)).then(function (_a) {
                var err = _a.err, data = _a.data;
                if (_this._isMounted && cb) {
                    cb(err, data);
                }
            });
        };
        _this.proxyCmdAndSync = function (cmd, params, cb) {
            if (!gProxyCmdAndSyncFunc) {
                throw new Error('must init datawatcher with a valid proxyCmdAndSync function!');
            }
            (0, amper_promise_utils_1.withError)(gProxyCmdAndSyncFunc(cmd, params)).then(function (_a) {
                var err = _a.err, data = _a.data;
                if (_this._isMounted && cb) {
                    cb(err, data);
                }
            });
        };
        _this.componentIsMounted = function () {
            return _this._isMounted;
        };
        return _this;
    }
    DataWatcher.prototype.UNSAFE_componentWillMount = function () {
        this._hasState = this.state && Object.keys(this.state).length > 0;
        this._origRender = this.render;
        this.render = this.renderWrapper;
        this._isMounted = true;
    };
    DataWatcher.prototype.getDataStore = function () {
        return this.context;
    };
    DataWatcher.prototype.getOverlay = function () {
        if (this.context instanceof dataOverlay_1.Overlay) {
            return this.context;
        }
        else {
            console.error('No enclosing <DataOverlay>');
            throw new Error('No enclosing <DataOverlay> for DataWatcher');
        }
    };
    DataWatcher.prototype.componentWillUnmount = function () {
        if (this._dataWatcher) {
            DataStoreWatch.destroyWatcher(this._dataWatcher);
            this._dataWatcher = null;
        }
        for (var _i = 0, _a = this._timers; _i < _a.length; _i++) {
            var timer = _a[_i];
            clearTimeout(timer);
        }
        this._timers = [];
        this._namedTimers = {};
        for (var _b = 0, _c = this._rafs; _b < _c.length; _b++) {
            var raf = _c[_b];
            SafeRaf.cancelAnimationFrame(raf);
        }
        this._rafs = [];
        this._isMounted = false;
    };
    DataWatcher.prototype.shouldComponentUpdate = function (nextProps, nextState, _nextContext) {
        if (hasChildren(this.props) || hasChildren(nextProps)) {
            // TODO any way to avoid this?
            return true;
        }
        if (this._hasState) {
            return comparePropsAndState(this, nextProps, nextState);
        }
        return !ObjUtils.objCmpFast(this.props, nextProps);
    };
    DataWatcher.prototype.renderWrapper = function () {
        if (!this._origRender || !this._isMounted) {
            return null;
        }
        this._inRender = true;
        this._dataWatcher && DataStoreWatch.resetWatches(this._dataWatcher);
        var start = Date.now();
        var ret = this._origRender(this._dataChanges);
        var delta = Date.now() - start;
        if (this._dataChanges.length && delta > SLOW_RENDER_CUTOFF) {
            console.log('Slow DataWatcher rerender', {
                name: this.constructor.name,
                time: delta,
                changes: ArrayUtils.arrayPull(this._dataChanges, 'pathStr'),
            });
        }
        this._dataChanges.length = 0;
        this._dataWatcher && DataStoreWatch.pruneUnusedWatches(this._dataWatcher);
        this._inRender = false;
        return ret;
    };
    DataWatcher.prototype.forceUpdate = function () {
        if (!this._isMounted) {
            return;
        }
        _super.prototype.forceUpdate.call(this);
    };
    DataWatcher.prototype.getWatcher = function () {
        // lazy create
        var needWatcher = (this.context instanceof dataOverlay_1.Overlay) || this._inRender;
        if (!this._dataWatcher && needWatcher && this._watchingEnabled) {
            this._dataWatcher = DataStoreWatch.createWatcher(REACT_PRIORITY, this.onDataChange, false, this.context);
        }
        return this._watchingEnabled ? this._dataWatcher : null;
    };
    DataWatcher.prototype.setWatchingEnabled = function (enabled) {
        if (enabled === this._watchingEnabled) {
            return;
        }
        this._watchingEnabled = enabled;
        if (!this._inRender) {
            if (enabled) {
                // force a render to readd the watches
                this.forceUpdate();
            }
            else if (this._dataWatcher) {
                // remove all watches
                DataStoreWatch.resetWatches(this._dataWatcher);
                DataStoreWatch.pruneUnusedWatches(this._dataWatcher);
            }
        }
    };
    DataWatcher.prototype.setTimeout = function (func, timeout) {
        var _this = this;
        if (!this._isMounted) {
            return undefined;
        }
        var handle;
        var onTimeout = function () {
            _this._deleteTimeout(handle);
            func();
        };
        handle = setTimeout(onTimeout, timeout);
        this._timers.push(handle);
        return handle;
    };
    DataWatcher.prototype._deleteTimeout = function (handle, name) {
        if (name) {
            handle = this._namedTimers[name];
            delete this._namedTimers[name];
        }
        if (!handle) {
            return;
        }
        var idx = this._timers.indexOf(handle);
        if (idx >= 0) {
            this._timers.splice(idx, 1);
        }
    };
    DataWatcher.prototype._clearTimeout = function (handle, name) {
        if (name) {
            handle = this._namedTimers[name];
            delete this._namedTimers[name];
        }
        if (!handle) {
            return;
        }
        clearTimeout(handle);
        this._deleteTimeout(handle);
    };
    DataWatcher.prototype.safeCb = function (fn) {
        var _this = this;
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (!_this._isMounted) {
                return;
            }
            else {
                return fn.apply(void 0, args);
            }
        };
    };
    DataWatcher.prototype.setNamedTimeout = function (name, func, timeout, replaceExisting) {
        var _this = this;
        if (!this._isMounted) {
            return undefined;
        }
        var onTimeout = function () {
            _this._deleteTimeout(_this._namedTimers[name], name);
            func();
        };
        if (this._namedTimers[name]) {
            if (replaceExisting) {
                this._clearTimeout(this._namedTimers[name], name);
            }
            else {
                // already set, do nothing, but return original handle
                return this._namedTimers[name];
            }
        }
        var t = this.setTimeout(onTimeout, timeout);
        if (t) {
            this._namedTimers[name] = t;
        }
        return this._namedTimers[name];
    };
    DataWatcher.prototype.clearNamedTimeout = function (name) {
        this._clearTimeout(undefined, name);
    };
    DataWatcher.prototype.hasNamedTimeout = function (name) {
        return Boolean(this._namedTimers[name]);
    };
    DataWatcher.prototype.requestAnimationFrame = function (func) {
        var _this = this;
        if (!this._isMounted) {
            return;
        }
        var handle;
        var onFrame = function () {
            var idx = _this._rafs.indexOf(handle);
            if (idx >= 0) {
                _this._rafs.splice(idx, 1);
            }
            func();
        };
        handle = SafeRaf.requestAnimationFrame(onFrame);
        this._rafs.push(handle);
    };
    // convenience functions
    DataWatcher.prototype.getData = function (path, objMask, defaults) {
        return DataStore.getData(this.getWatcher(), path, objMask, defaults);
    };
    DataWatcher.prototype.setInvalidateTimeout = function (cmdName, params, timeout) {
        var _this = this;
        var onTimeout = function () {
            _this.invalidateServerData(cmdName, params, true);
            //set it up again
            _this.setInvalidateTimeout(cmdName, params, timeout);
        };
        var cmdPath = DataServerCmd.svrCmdToPath(cmdName, params);
        if (cmdPath) {
            var name_1 = cmdPath.join('.');
            this.setNamedTimeout(name_1, onTimeout, timeout);
        }
    };
    DataWatcher.prototype.getServerData = function (cmdName, params, subPath, timeout, errCB) {
        if (!this._isMounted) {
            return null;
        }
        if (timeout) {
            this.setInvalidateTimeout(cmdName, params, timeout);
        }
        return DataServerCmd.getServerData(this.getWatcher(), cmdName, params, subPath, errCB);
    };
    DataWatcher.prototype.getServerDataWithError = function (cmdName, params, timeout, errCB) {
        if (!this._isMounted) {
            return {
                err: 'component not mounted',
                data: null,
            };
        }
        if (timeout) {
            this.setInvalidateTimeout(cmdName, params, timeout);
        }
        return DataServerCmd.getServerDataWithError(this.getWatcher(), cmdName, params, errCB);
    };
    DataWatcher.prototype.invalidateServerData = function (cmdName, params, noClear) {
        // this function exists so that people don't have to include both DataServerCmd and DataWatchMixin
        DataServerCmd.invalidateServerData(cmdName, params, noClear);
    };
    DataWatcher.prototype.setState = function (state, callback) {
        if (this._isMounted) {
            _super.prototype.setState.call(this, state, callback);
        }
    };
    DataWatcher.contextType = DataOverlay_1.DataOverlayContext;
    return DataWatcher;
}(React.Component));
exports.DataWatcher = DataWatcher;
