/* Copyright 2026 Jarsa
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    click,
    contains,
    defineMailModels,
    openDiscuss,
    start,
    startServer,
} from "@mail/../tests/mail_test_helpers";
import {describe, expect, test} from "@odoo/hoot";
import {onRpc} from "@web/../tests/web_test_helpers";
import {parseXml} from "@mail_attachment_xml_preview/xml_viewer.esm";

describe.current.tags("desktop");
defineMailModels();

const CFDI = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Total="1073.00">
<!-- emisor --><cfdi:Emisor Rfc="TLU080610C81" Nombre="ETN TURISTAR LUJO"/>
<cfdi:Conceptos><cfdi:Concepto Cantidad="1">Servicios de buses</cfdi:Concepto></cfdi:Conceptos>
</cfdi:Comprobante>`;

async function openXmlAttachment(content, attachmentValues = {}) {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        channel_type: "channel",
        name: "channel1",
    });
    const attachmentId = pyEnv["ir.attachment"].create({
        name: "factura.xml",
        mimetype: "text/plain",
        ...attachmentValues,
    });
    pyEnv["mail.message"].create({
        attachment_ids: [attachmentId],
        body: "<p>Test</p>",
        model: "discuss.channel",
        res_id: channelId,
        message_type: "comment",
    });
    onRpc(`/web/content/${attachmentId}`, () => {
        expect.step("fetch raw xml");
        return new Response(content, {headers: {"Content-Type": "text/plain"}});
    });
    await start();
    await openDiscuss(channelId);
    await click(".o-mail-AttachmentContainer.o-viewable");
    await contains(".o-FileViewer");
}

test("parseXml builds a hierarchy out of a one-line CFDI", () => {
    const root = parseXml(CFDI);
    expect(root.tag).toBe("cfdi:Comprobante");
    expect(root.attrs.map((attr) => attr.name)).toEqual(["xmlns:cfdi", "Total"]);
    expect(root.isBranch).toBe(true, {message: "the root node is collapsible"});
    expect(root.children.map((child) => child.type)).toEqual([
        "comment",
        "element",
        "element",
    ]);

    const [comment, emisor, conceptos] = root.children;
    expect(comment.value).toBe("emisor");
    expect(emisor.isBranch).toBe(false, {message: "an empty node is not collapsible"});
    expect(emisor.attrs[1].value).toBe("ETN TURISTAR LUJO");

    const concepto = conceptos.children[0];
    expect(concepto.isBranch).toBe(false, {
        message: "a text-only node is not collapsible",
    });
    expect(concepto.text).toBe("Servicios de buses");
});

test("parseXml rejects malformed XML", () => {
    expect(() => parseXml("<a><b></a>")).toThrow();
    expect(() => parseXml("not xml at all")).toThrow();
});

test("an XML attachment opens as a tree in the file viewer", async () => {
    await openXmlAttachment(CFDI);
    await contains(".o_xml_viewer details.o_xml_node > summary .o_xml_tag", {
        text: "<cfdi:Comprobante",
    });
    await contains(".o_xml_viewer summary .o_xml_attr_name", {text: "Total"});
    await contains(".o_xml_viewer summary .o_xml_attr_value", {text: '"1073.00"'});
    // Empty and text-only nodes are not collapsible.
    await contains(".o_xml_viewer details.o_xml_node", {count: 2});
    await contains(".o_xml_viewer .o_xml_comment", {text: "<!-- emisor -->"});
    await contains(".o_xml_viewer .o_xml_text", {text: "Servicios de buses"});
    // The plain text iframe of the standard viewer is replaced.
    await contains(".o-FileViewer iframe.o-isText", {count: 0});
    await expect.waitForSteps(["fetch raw xml"]);
});

test("a malformed XML attachment falls back to raw text", async () => {
    await openXmlAttachment("<a><b></a>");
    await contains(".o_xml_viewer pre.o_xml_viewer_raw", {text: "<a><b></a>"});
    await contains(".o_xml_viewer .o_xml_node", {count: 0});
    await expect.waitForSteps(["fetch raw xml"]);
});

test("a regular text attachment keeps the standard viewer", async () => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        channel_type: "channel",
        name: "channel1",
    });
    const attachmentId = pyEnv["ir.attachment"].create({
        name: "notes.txt",
        mimetype: "text/plain",
    });
    pyEnv["mail.message"].create({
        attachment_ids: [attachmentId],
        body: "<p>Test</p>",
        model: "discuss.channel",
        res_id: channelId,
        message_type: "comment",
    });
    await start();
    await openDiscuss(channelId);
    await click(".o-mail-AttachmentContainer.o-viewable");
    await contains(".o-FileViewer iframe.o-isText");
    await contains(".o_xml_viewer", {count: 0});
});
