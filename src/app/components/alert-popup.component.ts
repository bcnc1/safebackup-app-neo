import {Component, Input} from '@angular/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-alert-popup',
  template: `
    <div class="modal-header">
      <h4 class="modal-title pull-left">{{title}}</h4>
      <button type="button" class="close pull-right" aria-label="Close" (click)="bsModalRef.hide()">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="modal-body">
      {{message}}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-default" (click)="bsModalRef.hide()" translate="cancel"></button>
      <button type="button" class="btn btn-success" (click)="clickOk()" translate="ok"></button>
    </div>`,
  providers: [BsModalService]
})

export class AlertPopupComponent {
  @Input() title = 'Modal with component';
  @Input() message = 'Message here...';

  constructor(public bsModalRef: BsModalRef) {
  }

  public clickOk() {
    console.log('Click ok...');
  }
}
