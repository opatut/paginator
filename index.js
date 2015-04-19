$(document).ready(function () {
    var p1 = $('#paginator-1').paginator({
        dragEnabled: false
    });

    var p2 = $('#paginator-2').paginator({
        pageTransform: "stack"
    });

    var p3 = $('#paginator-3').paginator();

    var p4 = $('#paginator-4').paginator({
        pageTransform: "slide",
        onPageChanged: function (idx) {
            $("#page-select").val(idx + 1);
        }
    });

    $("#page-transform-select").change(function () {
        p4.setPageTransform($(this).val());
    });

    $("#page-select").change(function () {
        p4.setCurrentPage($(this).val() - 1);
    });
});
