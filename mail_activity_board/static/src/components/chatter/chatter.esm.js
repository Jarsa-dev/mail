import {Chatter} from "@mail/chatter/web_portal_project/chatter";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

patch(Chatter.prototype, {
    setup() {
        super.setup(...arguments);
        this.action = useService("action");
    },
    /**
     * Open the activity board filtered on the activities of the current record.
     */
    async onClickListActivity() {
        const thread = this.thread();
        if (!thread?.id) {
            return;
        }
        const action = await this.orm.call(
            thread.model,
            "redirect_to_activities",
            [[]],
            {
                id: thread.id,
                model: thread.model,
            }
        );
        await this.action.doAction(action, {
            onClose: () => this.onActivityChanged(thread),
        });
    },
});
