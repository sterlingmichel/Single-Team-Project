import { CommonModule } from "@angular/common";
import { NgModule, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";


import { MdbAccordionModule } from 'mdb-angular-ui-kit/accordion';
import { MdbAutocompleteModule } from 'mdb-angular-ui-kit/autocomplete';
import { MdbCarouselModule } from 'mdb-angular-ui-kit/carousel';
import { MdbChartModule } from 'mdb-angular-ui-kit/charts';
import { MdbCheckboxModule } from 'mdb-angular-ui-kit/checkbox';
import { MdbCollapseModule } from 'mdb-angular-ui-kit/collapse';
import { MdbDatepickerModule } from 'mdb-angular-ui-kit/datepicker';
import { MdbDropdownModule } from 'mdb-angular-ui-kit/dropdown';
import { MdbFormsModule } from 'mdb-angular-ui-kit/forms';
import { MdbInfiniteScrollModule } from 'mdb-angular-ui-kit/infinite-scroll';
import { MdbLazyLoadingModule } from 'mdb-angular-ui-kit/lazy-loading';
import { MdbLightboxModule } from 'mdb-angular-ui-kit/lightbox';
import { MdbLoadingModule } from 'mdb-angular-ui-kit/loading';
import { MdbModalModule } from 'mdb-angular-ui-kit/modal';
import { MdbNotificationModule } from 'mdb-angular-ui-kit/notification';
import { MdbPopconfirmModule } from 'mdb-angular-ui-kit/popconfirm';
import { MdbPopoverModule } from 'mdb-angular-ui-kit/popover';
import { MdbRadioModule } from 'mdb-angular-ui-kit/radio';
import { MdbRangeModule } from 'mdb-angular-ui-kit/range';
import { MdbRatingModule } from 'mdb-angular-ui-kit/rating';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { MdbScrollbarModule } from 'mdb-angular-ui-kit/scrollbar';
import { MdbScrollspyModule } from 'mdb-angular-ui-kit/scrollspy';
import { MdbSelectModule } from 'mdb-angular-ui-kit/select';
import { MdbSidenavModule } from 'mdb-angular-ui-kit/sidenav';
import { MdbSmoothScrollModule } from 'mdb-angular-ui-kit/smooth-scroll';
import { MdbStepperModule } from 'mdb-angular-ui-kit/stepper';
import { MdbStickyModule } from 'mdb-angular-ui-kit/sticky';
import { MdbTableModule } from 'mdb-angular-ui-kit/table';
import { MdbTabsModule } from 'mdb-angular-ui-kit/tabs';
import { MdbTimepickerModule } from 'mdb-angular-ui-kit/timepicker';
import { MdbTooltipModule } from 'mdb-angular-ui-kit/tooltip';
import { MdbValidationModule } from 'mdb-angular-ui-kit/validation';
import { MdbMultiRangeModule } from 'mdb-angular-ui-kit/multi-range';
import { MdbCalendarModule } from 'mdb-angular-calendar';
import { MdbWysiwygModule } from 'mdb-angular-wysiwyg';
import { MdbDragAndDropModule } from 'mdb-angular-drag-and-drop';
import { MdbVectorMapModule } from 'mdb-angular-vector-maps';
import { MdbFileUploadModule } from 'mdb-angular-file-upload';
import { MdbTreeviewModule } from 'mdb-angular-treeview';
import { MdbTransferModule } from 'mdb-angular-transfer';
import { MdbMentionModule } from 'mdb-angular-mention';
import { MdbCookiesManagementService } from 'mdb-angular-cookies-management';
import { MdbStorageManagementService } from 'mdb-angular-storage-management';
import { MdbOnboardingModule } from 'mdb-angular-onboarding';
import { MdbParallaxModule } from 'mdb-angular-parallax';
import { MdbInputMaskModule } from 'mdb-angular-input-mask';
import { MdbCountdownModule } from 'mdb-angular-countdown';
import { MdbScrollStatusService } from 'mdb-angular-scroll-status';
import { MdbMultiItemCarouselModule } from 'mdb-angular-multi-item-carousel';
import { MdbEcommerceGalleryModule } from 'mdb-angular-ecommerce-gallery';
import { MdbColorPickerModule } from 'mdb-angular-color-picker';
import { MdbCaptchaModule } from 'mdb-angular-captcha';
import { MdbOrganizationChartModule } from 'mdb-angular-organization-chart';
import { MdbDataParserModule } from 'mdb-angular-data-parser';
import { RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
import { NgxIntlTelInputModule } from "ngx-intl-tel-input";
import { InlineSVGModule } from "ng-inline-svg";
import { HttpClientModule } from "@angular/common/http";

@NgModule({
    imports: [
        // dep modules
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterOutlet, 
        RouterLink, 
        RouterLinkActive
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    declarations: [

    ],
    exports: [
        HttpClientModule,
        NgxIntlTelInputModule,
        InlineSVGModule,

        
        MdbSidenavModule,
        MdbModalModule,
        MdbNotificationModule,
        MdbDropdownModule,
        MdbCollapseModule,
        MdbTooltipModule,
        MdbInfiniteScrollModule,
        MdbFormsModule,
        MdbFileUploadModule,
        MdbDatepickerModule,
        MdbCheckboxModule,
        MdbSelectModule,
        MdbCalendarModule,
        MdbAutocompleteModule,
        MdbPopoverModule,
        MdbTimepickerModule,
        MdbChartModule,
        MdbTabsModule,
        MdbDatepickerModule,
        MdbTableModule,
        MdbCarouselModule,
        MdbScrollbarModule,
        MdbRippleModule,
        MdbTreeviewModule,

        RouterOutlet,
        RouterLink,
        RouterLinkActive
    ]
})
export class PipesApplicationModule { }