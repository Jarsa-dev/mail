/* Copyright 2026 Jarsa
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component, onWillStart, proxy, t, useProps} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

// Above this size the file is shown as raw text: parsing (and rendering) a
// huge DOM in the browser is slower than what a preview is worth.
export const MAX_XML_SIZE = 5 * 1024 * 1024;

function buildNode(element) {
    const children = [];
    for (const child of element.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            children.push(buildNode(child));
        } else if (child.nodeType === Node.COMMENT_NODE) {
            const value = child.nodeValue.trim();
            if (value) {
                children.push({type: "comment", value});
            }
        } else if (
            child.nodeType === Node.TEXT_NODE ||
            child.nodeType === Node.CDATA_SECTION_NODE
        ) {
            const value = child.nodeValue.trim();
            if (value) {
                children.push({type: "text", value});
            }
        }
    }
    // Only nodes holding something else than text are collapsible; a node with
    // text alone is rendered inline as <tag attrs>text</tag>, like an editor.
    const isBranch = children.some((child) => child.type !== "text");
    return {
        type: "element",
        tag: element.nodeName,
        attrs: [...element.attributes].map((attr) => ({
            name: attr.name,
            value: attr.value,
        })),
        children,
        isBranch,
        text: isBranch ? "" : children.map((child) => child.value).join(" "),
    };
}

/**
 * Turn an XML string into a plain-object tree the template can render.
 *
 * @param {String} text
 * @returns {Object} root node
 * @throws {Error} if the document is not well-formed XML
 */
export function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror") || !doc.documentElement) {
        throw new Error("Malformed XML");
    }
    return buildNode(doc.documentElement);
}

/**
 * One node of the tree. A component (instead of a recursive ``t-call``) keeps
 * each level with its own ``node`` prop.
 */
export class XmlNode extends Component {
    static template = "mail_attachment_xml_preview.XmlNode";
    static components = {};
    props = useProps({node: t.object()});
}
XmlNode.components = {XmlNode};

export class XmlViewer extends Component {
    static template = "mail_attachment_xml_preview.XmlViewer";
    static components = {XmlNode};
    props = useProps({file: t.object()});

    setup() {
        this.state = proxy({node: null, raw: "", loading: true});
        this.ui = useService("ui");
        // The file viewer gives a ``t-key`` to this component, so moving to
        // another file mounts a new viewer instead of updating this one.
        onWillStart(() => this.loadFile(this.props.file));
    }

    async loadFile(file) {
        let text = "";
        try {
            const response = await fetch(file.xmlRawUrl);
            text = response.ok ? await response.text() : "";
        } catch {
            text = "";
        }
        try {
            if (text.length > MAX_XML_SIZE) {
                throw new Error("File too large to render as a tree");
            }
            this.state.node = parseXml(text);
        } catch {
            // Not XML we can render (malformed, truncated, too big): fall back
            // to the raw content instead of showing nothing at all.
            this.state.raw = text;
        }
        this.state.loading = false;
    }
}
