/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
import { DataOverlayContext } from './DataOverlay';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';
import { Overlay } from 'data-store/dist/dataOverlay';
import { SvrCmdExecutor } from 'data-store/dist/dataServerCmd';
import * as DataStore from 'data-store/dist/dataStore';
import * as DataStoreWatch from 'data-store/dist/dataStoreWatch';
import * as React from 'react';
export type Callback = () => void;
export type DataCmdResp = {
    err?: ErrorType;
    data?: any;
};
export declare function init(svrCmdFunc: SvrCmdExecutor, proxyCmdAndSyncFunc: SvrCmdExecutor): void;
export declare function comparePropsAndState<P, S>(reactClass: React.Component<P, S>, props?: Readonly<P>, state?: Readonly<S>): boolean;
export declare class DataWatcher<P = {}, S = {}> extends React.Component<P, S> implements DataStoreWatch.DataWatcher {
    static contextType: React.Context<DataStore.IDataStore>;
    context: React.ContextType<typeof DataOverlayContext>;
    private _hasState;
    private _isMounted;
    private _dataWatcher;
    private _watchingEnabled;
    private _timers;
    private _namedTimers;
    private _rafs;
    private _inRender;
    private _origRender?;
    private _dataChanges;
    componentWillMount(): void;
    getDataStore(): DataStore.IDataStore;
    getOverlay(): Overlay;
    componentWillUnmount(): void;
    shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, _nextContext: any): any;
    renderWrapper(): any;
    private onDataChange;
    forceUpdate(): void;
    getWatcher(): DataStoreWatch.Watcher | null;
    setWatchingEnabled(enabled: boolean): void;
    setTimeout(func: Callback, timeout: number): number | undefined;
    private _deleteTimeout;
    private _clearTimeout;
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
    setNamedTimeout(name: string, func: Callback, timeout: number, replaceExisting?: boolean): number | undefined;
    clearNamedTimeout(name: string): void;
    hasNamedTimeout(name: string): boolean;
    requestAnimationFrame(func: Callback): void;
    getData(path: string[], objMask?: any, defaults?: any): any;
    setInvalidateTimeout(cmdName: string, params: any, timeout: number): void;
    getServerData(cmdName: string, params: any, subPath?: string[], timeout?: number, errCB?: any): any;
    getServerDataWithError(cmdName: string, params: any, timeout?: number, errCB?: any): DataCmdResp;
    invalidateServerData(cmdName: string, params: any, noClear?: boolean): void;
    setState<K extends keyof S>(f: (prevState: S, props: P) => Pick<S, K>, callback?: () => any): void;
    setState<K extends keyof S>(state: Pick<S, K>, callback?: () => any): any;
    svrCmd: (cmd: string, params: Stash, cb?: ErrDataCB<any>) => void;
    proxyCmdAndSync: (cmd: string, params: Stash, cb?: ErrDataCB<any>) => void;
    componentIsMounted: () => boolean;
}
