/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/

import { DataOverlayContext } from './DataOverlay';

import { withError } from 'amper-promise-utils';
import * as ArrayUtils from 'amper-utils/dist/arrayUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';
import { Overlay } from 'data-store/dist/dataOverlay';
import * as DataServerCmd from 'data-store/dist/dataServerCmd';
import { SvrCmdExecutor } from 'data-store/dist/dataServerCmd';
import * as DataStore from 'data-store/dist/dataStore';
import * as DataStoreWatch from 'data-store/dist/dataStoreWatch';
import * as React from 'react';
import * as SafeRaf from 'safe-raf';

const REACT_PRIORITY = 1000;
const SLOW_RENDER_CUTOFF = 50;

export type Callback = () => void;
export type DataCmdResp = {
  err?: ErrorType,
  data?: any,
};

let gSvrCmd: SvrCmdExecutor | null = null
let gProxyCmdAndSyncFunc: SvrCmdExecutor | null = null;

export function init(svrCmdFunc: SvrCmdExecutor, proxyCmdAndSyncFunc: SvrCmdExecutor) {
  gSvrCmd = svrCmdFunc;
  gProxyCmdAndSyncFunc = proxyCmdAndSyncFunc;
}

export function comparePropsAndState<P, S>(reactClass: React.Component<P, S>, props?: Readonly<P>, state?: Readonly<S>): boolean {
  if (!ObjUtils.objCmpFast(reactClass.props, props)) {
    return true;
  }
  if (!ObjUtils.objCmpFast(reactClass.state, state)) {
    return true;
  }
  return false;
}

function hasChildren(props: Stash) {
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

export class DataWatcher<P = {}, S = {}> extends React.Component<P, S> implements DataStoreWatch.DataWatcher {
  static contextType = DataOverlayContext;
  declare context: React.ContextType<typeof DataOverlayContext>;

  private _hasState: boolean = false;
  private _isMounted: boolean = false;

  private _dataWatcher: DataStoreWatch.Watcher|null = null;
  private _watchingEnabled: boolean = true;
  private _timers: number[] = [];
  private _namedTimers: Stash<number> = {};
  private _rafs: SafeRaf.AnimFrameUserHandle[] = [];

  private _inRender: boolean = false;
  private _origRender?: (any) => any;
  private _dataChanges: any[] = [];

  UNSAFE_componentWillMount() {
    this._hasState = this.state && Object.keys(this.state).length > 0;
    this._origRender = this.render;
    this.render = this.renderWrapper;
    this._isMounted = true;
  }

  getDataStore(): DataStore.IDataStore {
    return this.context;
  }

  getOverlay(): Overlay {
    if (this.context instanceof Overlay) {
      return this.context;
    } else {
      console.error('No enclosing <DataOverlay>');
      throw new Error('No enclosing <DataOverlay> for DataWatcher');
    }
  }

  componentWillUnmount() {
    if (this._dataWatcher) {
      DataStoreWatch.destroyWatcher(this._dataWatcher);
      this._dataWatcher = null;
    }

    for (let timer of this._timers) {
      clearTimeout(timer);
    }
    this._timers = [];
    this._namedTimers = {};

    for (let raf of this._rafs) {
      SafeRaf.cancelAnimationFrame(raf);
    }
    this._rafs = [];

    this._isMounted = false;
  }

  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, _nextContext: any) {
    if (hasChildren(this.props) || hasChildren(nextProps)) {
      // TODO any way to avoid this?
      return true;
    }
    if (this._hasState) {
      return comparePropsAndState(this, nextProps, nextState);
    }
    return !ObjUtils.objCmpFast(this.props, nextProps);
  }

  renderWrapper() {
    if (!this._origRender || !this._isMounted) {
      return null;
    }

    this._inRender = true;
    this._dataWatcher && DataStoreWatch.resetWatches(this._dataWatcher);

    const start = Date.now();
    let ret = this._origRender(this._dataChanges);
    const delta = Date.now() - start;
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
  }

  private onDataChange = (watcher: any, changes: any[]) => {
    // make sure we didn't get unmounted during watch triggering
    if (this._dataWatcher === watcher) {
      this._dataChanges.push.apply(this._dataChanges, changes);
      this.forceUpdate();
    }
  }

  forceUpdate() {
    if (!this._isMounted) {
      return;
    }
    super.forceUpdate();
  }

  getWatcher(): DataStoreWatch.Watcher|null {
    // lazy create
    const needWatcher = (this.context instanceof Overlay) || this._inRender;
    if (!this._dataWatcher && needWatcher && this._watchingEnabled) {
      this._dataWatcher = DataStoreWatch.createWatcher(REACT_PRIORITY, this.onDataChange, false, this.context);
    }
    return this._watchingEnabled ? this._dataWatcher : null;
  }

  setWatchingEnabled(enabled: boolean) {
    if (enabled === this._watchingEnabled) {
      return;
    }
    this._watchingEnabled = enabled;

    if (!this._inRender) {
      if (enabled) {
        // force a render to readd the watches
        this.forceUpdate();
      } else if (this._dataWatcher) {
        // remove all watches
        DataStoreWatch.resetWatches(this._dataWatcher);
        DataStoreWatch.pruneUnusedWatches(this._dataWatcher);
      }
    }
  }

  setTimeout(func: Callback, timeout: number): number | undefined {
    if (!this._isMounted) {
      return undefined;
    }

    let handle: number;

    let onTimeout = () => {
      this._deleteTimeout(handle);
      func();
    };

    handle = setTimeout(onTimeout, timeout);
    this._timers.push(handle);
    return handle;
  }

  private _deleteTimeout(handle?: number, name?: string) {
    if (name) {
      handle = this._namedTimers[name];
      delete this._namedTimers[name];
    }
    if (!handle) {
      return;
    }

    let idx = this._timers.indexOf(handle);
    if (idx >= 0) {
      this._timers.splice(idx, 1);
    }
  }

  private _clearTimeout(handle?: number, name?: string) {
    if (name) {
      handle = this._namedTimers[name];
      delete this._namedTimers[name];
    }
    if (!handle) {
      return;
    }
    clearTimeout(handle);
    this._deleteTimeout(handle);
  }

  /**
   * Wrap a callback such that it is safe to pass as a continuation handler.
   * The function returned will first check to see if this DataWatcher is still
   * mounted before delegating to the function passed.
   *
   * @param {function} fn The function to wrap.
   * @example setTimeout(this.safeCb(() => this.forceUpdate()), 5000); // force update in 5s iff the component is still mounted
   */
  safeCb<T1, R>(fn: (a: T1) => R): (a: T1) => R;
  safeCb<T1, T2, R>(fn: (a: T1, b: T2) => R): (a: T1, b: T2) => R;
  safeCb<T1, T2, T3, R>(fn: (a: T1, b: T2, c: T3) => R): (a: T1, b: T2, c: T3) => R;
  safeCb(fn: (...args: any[]) => any): (...args: any[]) => any {
    return (...args) => {
      if (!this._isMounted) {
        return;
      } else {
        return fn(...args);
      }
    };
  }

  setNamedTimeout(name: string, func: Callback, timeout: number, replaceExisting?: boolean): number | undefined {
    if (!this._isMounted) {
      return undefined;
    }

    let onTimeout = () => {
      this._deleteTimeout(this._namedTimers[name], name);
      func();
    };

    if (this._namedTimers[name]) {
      if (replaceExisting) {
        this._clearTimeout(this._namedTimers[name], name);
      } else {
        // already set, do nothing, but return original handle
        return this._namedTimers[name];
      }
    }

    let t = this.setTimeout(onTimeout, timeout);
    if (t) {
      this._namedTimers[name] = t;
    }

    return this._namedTimers[name];
  }

  clearNamedTimeout(name: string) {
    this._clearTimeout(undefined, name);
  }

  hasNamedTimeout(name: string) : boolean {
    return Boolean(this._namedTimers[name]);
  }

  requestAnimationFrame(func: Callback) {
    if (!this._isMounted) {
      return;
    }

    let handle: SafeRaf.AnimFrameUserHandle;

    let onFrame = () => {
      let idx = this._rafs.indexOf(handle);
      if (idx >= 0) {
        this._rafs.splice(idx, 1);
      }
      func();
    };

    handle = SafeRaf.requestAnimationFrame(onFrame);
    this._rafs.push(handle);
  }

  // convenience functions
  getData(path: string[], objMask?: any, defaults?: any): any { // null | number | string | {[s: string]: any}
    return DataStore.getData(this.getWatcher(), path, objMask, defaults);
  }

  setInvalidateTimeout(cmdName: string, params: any, timeout: number) {
    let onTimeout = () => {
      this.invalidateServerData(cmdName, params, true);
      //set it up again
      this.setInvalidateTimeout(cmdName, params, timeout);
    };

    let cmdPath = DataServerCmd.svrCmdToPath(cmdName, params);
    if (cmdPath) {
      let name: string = cmdPath.join('.');
      this.setNamedTimeout(name, onTimeout, timeout);
    }
  }

  getServerData(cmdName: string, params: any, subPath?: string[], timeout?: number, errCB?: any): any {
    if (!this._isMounted) {
      return null;
    }
    if (timeout) {
      this.setInvalidateTimeout(cmdName, params, timeout);
    }
    return DataServerCmd.getServerData(this.getWatcher(), cmdName, params, subPath, errCB);
  }

  getServerDataWithError(cmdName: string, params: any, timeout?: number, errCB?: any) : DataCmdResp {
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
  }

  invalidateServerData(cmdName: string, params: any, noClear?: boolean) {
    // this function exists so that people don't have to include both DataServerCmd and DataWatchMixin
    DataServerCmd.invalidateServerData(cmdName, params, noClear);
  }

  setState<K extends keyof S>(f: (prevState: S, props: P) => Pick<S, K>, callback?: () => any): void;
  setState<K extends keyof S>(state: Pick<S, K>, callback?: () => any);
  setState(state, callback) {
    if (this._isMounted) {
      super.setState(state, callback);
    }
  }

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

  svrCmd = (cmd: string, params: Stash, cb?: ErrDataCB<any>) => {
    if (!gSvrCmd) {
      throw new Error('must init datawatcher with a valid svrCmd function!');
    }
    withError(gSvrCmd(cmd, params)).then(({err, data}) => {
      if (this._isMounted && cb) {
        cb(err, data);
      }
    });
  }

  proxyCmdAndSync = (cmd: string, params: Stash, cb?: ErrDataCB<any>) => {
    if (!gProxyCmdAndSyncFunc) {
      throw new Error('must init datawatcher with a valid proxyCmdAndSync function!');
    }
    withError(gProxyCmdAndSyncFunc(cmd, params)).then(({err, data}) => {
      if (this._isMounted && cb) {
        cb(err, data);
      }
    });
  }

  componentIsMounted = () => {
    return this._isMounted;
  }
}
