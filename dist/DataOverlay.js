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
exports.DataOverlay = exports.DataOverlayContext = void 0;
var dataOverlay_1 = require("data-store/dist/dataOverlay");
var DataStore = require("data-store/dist/dataStore");
var PropTypes = require("prop-types");
var React = require("react");
exports.DataOverlayContext = React.createContext(DataStore);
var DataOverlay = /** @class */ (function (_super) {
    __extends(DataOverlay, _super);
    function DataOverlay() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataOverlay.prototype.getOverlay = function () {
        return this._overlay;
    };
    DataOverlay.prototype.componentWillMount = function () {
        var _a;
        this._overlay = (_a = this.props.dataStore) !== null && _a !== void 0 ? _a : new dataOverlay_1.Overlay(this.context);
    };
    DataOverlay.prototype.componentWillUpdate = function (newProps) {
        if (this.props.dataStore !== newProps.dataStore) {
            console.error('The props of <DataOverlay> cannot be changed midrun');
        }
    };
    DataOverlay.prototype.componentWillUnmount = function () {
        if (this._overlay && !this.props.dataStore) {
            this._overlay.uninit();
        }
    };
    DataOverlay.prototype.render = function () {
        return (React.createElement(exports.DataOverlayContext.Provider, { value: this._overlay }, this.props.children));
    };
    DataOverlay.contextType = exports.DataOverlayContext;
    DataOverlay.propTypes = {
        dataStore: PropTypes.object,
        children: PropTypes.element.isRequired,
    };
    return DataOverlay;
}(React.Component));
exports.DataOverlay = DataOverlay;
