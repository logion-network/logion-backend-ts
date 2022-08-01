import { EtherscanScrapper } from "../../../src/logion/services/etherscanscrapper";

describe("EtherscanScrapper", () => {

    it("detects token in holder inventory page", () => {
        testPageContainsToken(tokenInventoryWithHolder, true);
    });

    it("does not detect token if not in holder inventory page", () => {
        testPageContainsToken(tokenInventoryWithAnotherHolder, false);
    });
});

function testPageContainsToken(pageContent: string, expected: boolean) {
    const scrapper = new EtherscanScrapper(pageContent);
    const contains = scrapper.tokenHolderInventoryPageContainsHolder(holderAddress);
    expect(contains).toBe(expected);
}

export const emptyHolderInventory = `
<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta name="Description" content="The Ethereum BlockChain Explorer, API and Analytics Platform">
<meta name="author" content="etherscan.io">
<meta name="keywords" content="ethereum, explorer, ether, search, blockchain, crypto, currency">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex">
<link rel="shortcut icon" href='/images/favicon2.ico'>
<script src="/assets/vendor/jquery/dist/jquery.min.js?v=22.7.3.1"></script>
<script src="/assets/vendor/popper.js/dist/umd/popper.min.js?v=22.7.3.1"></script>
<script src="/assets/vendor/bootstrap/bootstrap.min.js?v=22.7.3.1"></script>
<script src="/assets/js/hs.core.js?v=22.7.3.1"></script>
<link rel="stylesheet" href="/assets/vendor/font-awesome/css/fontawesome-all.min.css?v=22.7.3.1">
<link rel="stylesheet" href="/assets/css/theme.min.css?v=22.7.3.1">
<style>
        #overlay {
         
            color: #666666;
            position: fixed;
            height: 100%;
            width: 100%;
            z-index: 5000;
            top: 0;
            left: 0;
            float: left;
            text-align: center;
           
           
        }

         .graphic {
             height: 140px;
         }

         .owner {
             white-space: nowrap;
             overflow: hidden;
             text-overflow: ellipsis;
             display: block;
             margin-left: 12%;
             width:80%;
         }

         .ens-block {
             background: #598df6 url(../../images/svg/brands/ens-light.svg) 50% no-repeat !important;
         }

         .ens-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }

         .crypto-block {
             background: #598df6 url(../../images/svg/brands/unstopabbledomains-light.svg) 50% no-repeat !important;
             background-size: cover !important;
         }

         .crypto-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }
       
    </style>
<script>
        function nftImageErrorHandler(el) {
            $(el).attr('src', '/images/main/nft-placeholder.svg');
            $(el).attr('style', 'width: 64px;');
            $(el).parent().addClass("bg-soft-secondary")
        }
    </script>
</head>
<body id="body">
<script>window.parent.isFrameLoading = true;</script>
<div class="d-md-flex justify-content-between mb-4">
<p class="mb-2 mb-md-0">
<i id="spinwheel" class="fa fa-spin fa-spinner fa-1x fa-pulse mr-1" style="display: none;"></i>
&nbsp;A total of 1 token found
</p>
<nav aria-label="page navigation">
<ul class="pagination pagination-sm mb-0"><li class="page-item"><a class="page-link" href="javascript:move('generic-tokenholder-inventory?contractAddress=0x765df6da33c1ec1f83be42db171d7ee334a46df5&amp;a=0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84&amp;m=normal&amp;p=1')"><span aria-hidden="True">First</span> <span class="sr-only">First</span></a></li><li class="page-item" data-toggle='tooltip' title="Go to Previous"><a class="page-link" href="javascript:move('generic-tokenholder-inventory?contractAddress=0x765df6da33c1ec1f83be42db171d7ee334a46df5&amp;a=0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84&amp;m=normal&amp;p=1')" aria-label="Previous"><span aria-hidden="True"><i class="fa fa-chevron-left small"></i></span> <span class="sr-only">Previous</span></a></li><li Class="page-item disabled"><span Class="page-link text-nowrap">Page <strong class="font-weight-medium">2</strong> of <strong class="font-weight-medium">1</strong></span></li><li class="page-item disabled"><span class="page-link"><i class="fa fa-chevron-right small"></i></span><span class="sr-only">Previous</span></li><li class="page-item disabled"><span class="page-link">Last</span></li>
</nav>
</div>
<div id="resulttable">
<table class="table table-hover">
<thead class="thead-light">
<tr>
<th scope="col" width="1">Token_id
</th>
<th scope="col">
</th>
<th>
</th>
</tr>
</thead>
<tbody>
<tr><td colspan='4'><div class='alert alert-warning mb-0' role='alert'>There are no matching entries</div></td><tr>
</tbody>
</table>
</div>
<div class="d-flex justify-content-md-end align-items-center text-secondary mb-2 mb-md-0 my-3">
<div class="d-inline-block">
</div>
</div>
</body>
<script>
    $(window).on('load', function () {
        $('#overlay').fadeOut();                  
        window.parent.document.getElementById('loadingtxframe6').style.display = "none";
     
        setTimeout(function () {
            var obj = window.parent.document.getElementById('tokenerc721_inventory_pageiframe');
            parent.resizeIframe(obj, 0);
        }, 150);  
        window.parent.isFrameLoading = false;  
        window.parent.token_inventory_loaded = true;
        window.parent.document.getElementById('overlayMain').style.display = 'none';
    });

    $(document).ready(function () {
        
        $('.btn-xs').click(function () {
            //window.parent.document.getElementById('overlayMain').style.display = 'block';
        });

        $(".js-fancybox").click(function () {
            var index = $(".js-fancybox").index(this);            
            parent.loadFancyBox($("[data-fancybox]"),  index);
        });
       
    });        
   
    function move(strlink) {
        $('#overlay').show();     
        $('#overlay').fadeIn();     
        window.location = "/token/" + strlink;
    }  
    
    var objNFTInfo = {}
    function getNFTInfo(el, address, token_id) {
        var el = $(el)
        if (!objNFTInfo[token_id]){
            el.popover({
                trigger: 'focus',
                html: true,
                placement: 'right',
                content: '<div class="popover popover-body" id="spinner-wrapper" style="height: 40px !important;"><i class="fas fa-circle-notch fa-spin spinner-wrapper__icon position-relativer text-primary fa-2x mb-2" style="top: unset"></i></div>',
            })
            el.popover("show");

            var data = {
                address: address,
                token_id: token_id
            }

            $.ajax({
                method: "GET",
                url: 'https://api.opensea.io/api/v1/asset/' + address + '/' + token_id + '/',
                data: data,
                success: function (data) {
                    var traits = data.traits
                    var expirationTime = traits.find(k => k.trait_type == "Expiration Time")

                    var html = ""
                    html += '<div class="card">'
                    html += '<img src="' + data.image_url + '" width="260px" class="card-img-top"">'
                    html += '<div class="card-body">'
                    html += '<a href="/token/0x181aea6936b407514ebfc0754a37704eb8d98f91?a=' + token_id + '#inventory" target="_parent">' + token_id + '</a>'
                    html += '<br>'
                    html += '<strong>' + data.collection.name + '</strong>'
                    html += '<br>'
                    html += data.name
                    html += '<br>'
                    html += '<span class="text-secondary">Valid until ' + new Date(expirationTime.value * 1000).toUTCString() + '</span>'
                    html += '</div>'
                    html += '</div>'
                   
                    objNFTInfo[token_id] = html
                    el.attr('data-content', objNFTInfo[token_id]);
                    el.popover("show")
                },
                error: function (error) {
                    console.log("error getNFTInfo")
                }
            })
        }
    }

</script>
<style>
    .popover {
        min-height: 100px;
        min-width: 260px;
        border: none;
        box-shadow: 0 0.5rem 1.2rem rgba(189,197,209,.7);
    }
    
</style>
</html>`;

const holderAddress = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

export const tokenInventoryWithHolder = `
<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta name="Description" content="The Ethereum BlockChain Explorer, API and Analytics Platform">
<meta name="author" content="etherscan.io">
<meta name="keywords" content="ethereum, explorer, ether, search, blockchain, crypto, currency">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex">
<link rel="shortcut icon" href='/images/favicon2.ico'>
<script src="/assets/vendor/jquery/dist/jquery.min.js?v=22.7.4.1"></script>
<script src="/assets/vendor/popper.js/dist/umd/popper.min.js?v=22.7.4.1"></script>
<script src="/assets/vendor/bootstrap/bootstrap.min.js?v=22.7.4.1"></script>
<script src="/assets/js/hs.core.js?v=22.7.4.1"></script>
<link rel="stylesheet" href="/assets/vendor/font-awesome/css/fontawesome-all.min.css?v=22.7.4.1">
<link rel="stylesheet" href="/assets/css/theme.min.css?v=22.7.4.1">
<style>
        #overlay {
         
            color: #666666;
            position: fixed;
            height: 100%;
            width: 100%;
            z-index: 5000;
            top: 0;
            left: 0;
            float: left;
            text-align: center;
           
           
        }

         .graphic {
             height: 140px;
         }

         .owner {
             white-space: nowrap;
             overflow: hidden;
             text-overflow: ellipsis;
             display: block;
             margin-left: 12%;
             width:80%;
         }

         .ens-block {
             background: #598df6 url(../../images/svg/brands/ens-light.svg) 50% no-repeat !important;
         }

         .ens-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }

         .crypto-block {
             background: #598df6 url(../../images/svg/brands/unstopabbledomains-light.svg) 50% no-repeat !important;
             background-size: cover !important;
         }

         .crypto-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }
       
    </style>
<script>
        function nftImageErrorHandler(el) {
            $(el).attr('src', '/images/main/nft-placeholder.svg');
            $(el).attr('style', 'width: 64px;');
            $(el).parent().addClass("bg-soft-secondary")
        }
    </script>
</head>
<body id="body">
<script>window.parent.isFrameLoading = true;</script>
<div class="d-md-flex justify-content-between mb-4">
<p class="mb-2 mb-md-0">
<i id="spinwheel" class="fa fa-spin fa-spinner fa-1x fa-pulse mr-1" style="display: none;"></i>
&nbsp;A total of 1 token found
</p>
<nav aria-label="page navigation">
<ul class="pagination pagination-sm mb-0"><li class="page-item disabled"><span class="page-link">First</span></li><li class="page-item disabled"><span class="page-link"><i class="fa fa-chevron-left small"></i></span><span class="sr-only">Previous</span></li><li Class="page-item disabled"><span Class="page-link text-nowrap">Page <strong class="font-weight-medium">1</strong> of <strong class="font-weight-medium">1</strong></span></li><li class="page-item disabled"><span class="page-link"><i class="fa fa-chevron-right small"></i></span><span class="sr-only">Previous</span></li><li class="page-item disabled"><span class="page-link">Last</span></li>
</nav>
</div>
<div id='grid-container' class='row row-cols-mobile-1 row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 mx-0'><div class='col mb-4'><div class='nft-block-wrapper'><a href='/nft/0x765df6da33c1ec1f83be42db171d7ee334a46df5/4391' target='_parent'><span class='nft-block bg-soft-secondary'><img class='nft-block-img' loading='lazy' style='width:64px;' src='/images/main/nft-placeholder.svg' onerror='nftImageErrorHandler(this)'></span></a><div class='font-size-1 text-secondary text-truncate mb-1'>Token ID: <a href='/token/0x765df6da33c1ec1f83be42db171d7ee334a46df5?a=4391' target='_parent' data-toggle='tooltip' title='4391'>4391</a></div><div class='font-size-1 text-secondary text-truncate' data-toggle='tooltip' title='0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84'>Owner: <a href='/token/0x765df6da33c1ec1f83be42db171d7ee334a46df5?a=0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84' target='_parent'>0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84</a></div><div class='font-size-1 text-secondary text-truncate' data-toggle='tooltip' title='Click to see transaction with last traded price of $1.68 (0.0010ETH)'>Last Traded: <a href='/tx/0xa93457007d2fddd604bd1a9228cd2f1bc99d6d338653b35a163857f5c9b18524' target='_parent'>$1.68 (0.0010 ETH)</a></div></div></div></div>
<div class="d-flex justify-content-md-end align-items-center text-secondary mb-2 mb-md-0 my-3">
<div class="d-inline-block">
</div>
</div>
<script>(function(){var js = "window['__CF$cv$params']={r:'733ceb5e58d883db',m:'4wWRxK5BdQ0ZwwGEXkBoT8faH3h86EdLp33kbRo8.n8-1659339560-0-AcuzDIinHQuWFvSDPbcN1HijEZXVHL0M9m8LeImAr/YLZf6RXJ+GEho4rvzcB8X89Esflxy/woyh/WIKLbkyusIEpEs2Yth0CCICfjaeEnox52ijsBzfVIB1bxnJPB5SPGK28sAqXrl/F2VTLiSaK7NW8k5C8RCiJsJMEtJg7YdVhVLCX3v6P47NwjjafnsM2N2SOLj+Tt52pWIzD5ObDJ1vFj24rdQ4YpEiR+OE2tUZMSVZrH8xJCX7r2gCISMds5IZg2yBOkZg+tslucdxIds=',s:[0x278a0370ba,0x3efef1554e],u:'/cdn-cgi/challenge-platform/h/g'};var now=Date.now()/1000,offset=14400,ts=''+(Math.floor(now)-Math.floor(now%offset)),_cpo=document.createElement('script');_cpo.nonce='',_cpo.src='/cdn-cgi/challenge-platform/h/g/scripts/alpha/invisible.js?ts='+ts,document.getElementsByTagName('head')[0].appendChild(_cpo);";var _0xh = document.createElement('iframe');_0xh.height = 1;_0xh.width = 1;_0xh.style.position = 'absolute';_0xh.style.top = 0;_0xh.style.left = 0;_0xh.style.border = 'none';_0xh.style.visibility = 'hidden';document.body.appendChild(_0xh);function handler() {var _0xi = _0xh.contentDocument || _0xh.contentWindow.document;if (_0xi) {var _0xj = _0xi.createElement('script');_0xj.nonce = '';_0xj.innerHTML = js;_0xi.getElementsByTagName('head')[0].appendChild(_0xj);}}if (document.readyState !== 'loading') {handler();} else if (window.addEventListener) {document.addEventListener('DOMContentLoaded', handler);} else {var prev = document.onreadystatechange || function () {};document.onreadystatechange = function (e) {prev(e);if (document.readyState !== 'loading') {document.onreadystatechange = prev;handler();}};}})();</script></body>
<script>
    $(window).on('load', function () {
        $('#overlay').fadeOut();                  
        window.parent.document.getElementById('loadingtxframe6').style.display = "none";
     
        setTimeout(function () {
            var obj = window.parent.document.getElementById('tokenerc721_inventory_pageiframe');
            parent.resizeIframe(obj, 0);
        }, 150);  
        window.parent.isFrameLoading = false;  
        window.parent.token_inventory_loaded = true;
        window.parent.document.getElementById('overlayMain').style.display = 'none';
    });

    $(document).ready(function () {
        
        $('.btn-xs').click(function () {
            //window.parent.document.getElementById('overlayMain').style.display = 'block';
        });

        $(".js-fancybox").click(function () {
            var index = $(".js-fancybox").index(this);            
            parent.loadFancyBox($("[data-fancybox]"),  index);
        });
       
    });        
   
    function move(strlink) {
        $('#overlay').show();     
        $('#overlay').fadeIn();     
        window.location = "/token/" + strlink;
    }  
    
    var objNFTInfo = {}
    function getNFTInfo(el, address, token_id) {
        var el = $(el)
        if (!objNFTInfo[token_id]){
            el.popover({
                trigger: 'focus',
                html: true,
                placement: 'right',
                content: '<div class="popover popover-body" id="spinner-wrapper" style="height: 40px !important;"><i class="fas fa-circle-notch fa-spin spinner-wrapper__icon position-relativer text-primary fa-2x mb-2" style="top: unset"></i></div>',
            })
            el.popover("show");

            var data = {
                address: address,
                token_id: token_id
            }

            $.ajax({
                method: "GET",
                url: 'https://api.opensea.io/api/v1/asset/' + address + '/' + token_id + '/',
                data: data,
                success: function (data) {
                    var traits = data.traits
                    var expirationTime = traits.find(k => k.trait_type == "Expiration Time")

                    var html = ""
                    html += '<div class="card">'
                    html += '<img src="' + data.image_url + '" width="260px" class="card-img-top"">'
                    html += '<div class="card-body">'
                    html += '<a href="/token/0x181aea6936b407514ebfc0754a37704eb8d98f91?a=' + token_id + '#inventory" target="_parent">' + token_id + '</a>'
                    html += '<br>'
                    html += '<strong>' + data.collection.name + '</strong>'
                    html += '<br>'
                    html += data.name
                    html += '<br>'
                    html += '<span class="text-secondary">Valid until ' + new Date(expirationTime.value * 1000).toUTCString() + '</span>'
                    html += '</div>'
                    html += '</div>'
                   
                    objNFTInfo[token_id] = html
                    el.attr('data-content', objNFTInfo[token_id]);
                    el.popover("show")
                },
                error: function (error) {
                    console.log("error getNFTInfo")
                }
            })
        }
    }

</script>
<style>
    .popover {
        min-height: 100px;
        min-width: 260px;
        border: none;
        box-shadow: 0 0.5rem 1.2rem rgba(189,197,209,.7);
    }
    
</style>
</html>`;

export const tokenInventoryWithAnotherHolder = `
<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta name="Description" content="The Ethereum BlockChain Explorer, API and Analytics Platform">
<meta name="author" content="etherscan.io">
<meta name="keywords" content="ethereum, explorer, ether, search, blockchain, crypto, currency">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex">
<link rel="shortcut icon" href='/images/favicon2.ico'>
<script src="/assets/vendor/jquery/dist/jquery.min.js?v=22.7.4.1"></script>
<script src="/assets/vendor/popper.js/dist/umd/popper.min.js?v=22.7.4.1"></script>
<script src="/assets/vendor/bootstrap/bootstrap.min.js?v=22.7.4.1"></script>
<script src="/assets/js/hs.core.js?v=22.7.4.1"></script>
<link rel="stylesheet" href="/assets/vendor/font-awesome/css/fontawesome-all.min.css?v=22.7.4.1">
<link rel="stylesheet" href="/assets/css/theme.min.css?v=22.7.4.1">
<style>
        #overlay {
         
            color: #666666;
            position: fixed;
            height: 100%;
            width: 100%;
            z-index: 5000;
            top: 0;
            left: 0;
            float: left;
            text-align: center;
           
           
        }

         .graphic {
             height: 140px;
         }

         .owner {
             white-space: nowrap;
             overflow: hidden;
             text-overflow: ellipsis;
             display: block;
             margin-left: 12%;
             width:80%;
         }

         .ens-block {
             background: #598df6 url(../../images/svg/brands/ens-light.svg) 50% no-repeat !important;
         }

         .ens-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }

         .crypto-block {
             background: #598df6 url(../../images/svg/brands/unstopabbledomains-light.svg) 50% no-repeat !important;
             background-size: cover !important;
         }

         .crypto-block--light {
             background-color: rgba(89,141,246,.6) !important;
             font-style: italic;
         }
       
    </style>
<script>
        function nftImageErrorHandler(el) {
            $(el).attr('src', '/images/main/nft-placeholder.svg');
            $(el).attr('style', 'width: 64px;');
            $(el).parent().addClass("bg-soft-secondary")
        }
    </script>
</head>
<body id="body">
<script>window.parent.isFrameLoading = true;</script>
<div class="d-md-flex justify-content-between mb-4">
<p class="mb-2 mb-md-0">
<i id="spinwheel" class="fa fa-spin fa-spinner fa-1x fa-pulse mr-1" style="display: none;"></i>
&nbsp;A total of 1 token found
</p>
<nav aria-label="page navigation">
<ul class="pagination pagination-sm mb-0"><li class="page-item disabled"><span class="page-link">First</span></li><li class="page-item disabled"><span class="page-link"><i class="fa fa-chevron-left small"></i></span><span class="sr-only">Previous</span></li><li Class="page-item disabled"><span Class="page-link text-nowrap">Page <strong class="font-weight-medium">1</strong> of <strong class="font-weight-medium">1</strong></span></li><li class="page-item disabled"><span class="page-link"><i class="fa fa-chevron-right small"></i></span><span class="sr-only">Previous</span></li><li class="page-item disabled"><span class="page-link">Last</span></li>
</nav>
</div>
<div id='grid-container' class='row row-cols-mobile-1 row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 mx-0'><div class='col mb-4'><div class='nft-block-wrapper'><a href='/nft/0x765df6da33c1ec1f83be42db171d7ee334a46df5/4392' target='_parent'><span class='nft-block bg-soft-secondary'><img class='nft-block-img' loading='lazy' style='width:64px;' src='/images/main/nft-placeholder.svg' onerror='nftImageErrorHandler(this)'></span></a><div class='font-size-1 text-secondary text-truncate mb-1'>Token ID: <a href='/token/0x765df6da33c1ec1f83be42db171d7ee334a46df5?a=4392' target='_parent' data-toggle='tooltip' title='4392'>4392</a></div><div class='font-size-1 text-secondary text-truncate' data-toggle='tooltip' title='0xe60ee66bd4db2e6da0f0c76275cb318add31fbf1'>Owner: <a href='/token/0x765df6da33c1ec1f83be42db171d7ee334a46df5?a=0xe60ee66bd4db2e6da0f0c76275cb318add31fbf1' target='_parent'>0xe60ee66bd4db2e6da0f0c76275cb318add31fbf1</a></div><div class='font-size-1 text-secondary text-truncate'>Last Traded: N/A</div></div></div></div>
<div class="d-flex justify-content-md-end align-items-center text-secondary mb-2 mb-md-0 my-3">
<div class="d-inline-block">
</div>
</div>
</body>
<script>
    $(window).on('load', function () {
        $('#overlay').fadeOut();                  
        window.parent.document.getElementById('loadingtxframe6').style.display = "none";
     
        setTimeout(function () {
            var obj = window.parent.document.getElementById('tokenerc721_inventory_pageiframe');
            parent.resizeIframe(obj, 0);
        }, 150);  
        window.parent.isFrameLoading = false;  
        window.parent.token_inventory_loaded = true;
        window.parent.document.getElementById('overlayMain').style.display = 'none';
    });

    $(document).ready(function () {
        
        $('.btn-xs').click(function () {
            //window.parent.document.getElementById('overlayMain').style.display = 'block';
        });

        $(".js-fancybox").click(function () {
            var index = $(".js-fancybox").index(this);            
            parent.loadFancyBox($("[data-fancybox]"),  index);
        });
       
    });        
   
    function move(strlink) {
        $('#overlay').show();     
        $('#overlay').fadeIn();     
        window.location = "/token/" + strlink;
    }  
    
    var objNFTInfo = {}
    function getNFTInfo(el, address, token_id) {
        var el = $(el)
        if (!objNFTInfo[token_id]){
            el.popover({
                trigger: 'focus',
                html: true,
                placement: 'right',
                content: '<div class="popover popover-body" id="spinner-wrapper" style="height: 40px !important;"><i class="fas fa-circle-notch fa-spin spinner-wrapper__icon position-relativer text-primary fa-2x mb-2" style="top: unset"></i></div>',
            })
            el.popover("show");

            var data = {
                address: address,
                token_id: token_id
            }

            $.ajax({
                method: "GET",
                url: 'https://api.opensea.io/api/v1/asset/' + address + '/' + token_id + '/',
                data: data,
                success: function (data) {
                    var traits = data.traits
                    var expirationTime = traits.find(k => k.trait_type == "Expiration Time")

                    var html = ""
                    html += '<div class="card">'
                    html += '<img src="' + data.image_url + '" width="260px" class="card-img-top"">'
                    html += '<div class="card-body">'
                    html += '<a href="/token/0x181aea6936b407514ebfc0754a37704eb8d98f91?a=' + token_id + '#inventory" target="_parent">' + token_id + '</a>'
                    html += '<br>'
                    html += '<strong>' + data.collection.name + '</strong>'
                    html += '<br>'
                    html += data.name
                    html += '<br>'
                    html += '<span class="text-secondary">Valid until ' + new Date(expirationTime.value * 1000).toUTCString() + '</span>'
                    html += '</div>'
                    html += '</div>'
                   
                    objNFTInfo[token_id] = html
                    el.attr('data-content', objNFTInfo[token_id]);
                    el.popover("show")
                },
                error: function (error) {
                    console.log("error getNFTInfo")
                }
            })
        }
    }

</script>
<style>
    .popover {
        min-height: 100px;
        min-width: 260px;
        border: none;
        box-shadow: 0 0.5rem 1.2rem rgba(189,197,209,.7);
    }
    
</style>
</html>`;
