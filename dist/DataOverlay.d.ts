/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/
import { Overlay } from 'data-store/dist/dataOverlay';
import * as DataStore from 'data-store/dist/dataStore';
import * as React from 'react';
export declare const DataOverlayContext: React.Context<DataStore.IDataStore>;
export declare class DataOverlay extends React.Component<React.PropsWithChildren<{
    dataStore?: Overlay;
}>, {}> {
    static contextType: React.Context<DataStore.IDataStore>;
    context: React.ContextType<typeof DataOverlayContext>;
    private _overlay;
    getOverlay(): Overlay;
    UNSAFE_componentWillMount(): void;
    UNSAFE_componentWillUpdate(newProps: any): void;
    componentWillUnmount(): void;
    render(): JSX.Element;
}
