# Copyright 2026 Jarsa
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
from odoo.tests import tagged

from odoo.addons.web.tests.test_js import HootCommon, unit_test_error_checker


@tagged("post_install", "-at_install")
class TestXmlViewerJs(HootCommon):
    def test_hoot(self):
        """Run the Hoot suite of this module in a real browser."""
        module_filter = self._generate_hash("@mail_attachment_xml_preview")
        self.browser_js(
            "/web/tests?headless&loglevel=2&preset=desktop&timeout=15000"
            f"&id={module_filter}",
            "",
            "",
            login="admin",
            timeout=600,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=unit_test_error_checker,
        )
