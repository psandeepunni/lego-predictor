#!/usr/bin/perl

use strict;
use warnings;
use LWP::Simple;
use HTML::TreeBuilder::XPath;

open my $fh, ">:encoding(utf8)", "lego_set_urls.csv" or die "lego_set_urls.csv: $!";

my $tree= HTML::TreeBuilder::XPath->new;
my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime();
my $current_year = 1900+$year;

my $total_page_count = 1;
print $fh "lego_set_id,lego_set_title,rebrickable_lego_set_url,bricket_lego_set_url,brickpicker_lego_set_url\n";

for (my $i = 1; $i <= $total_page_count; $i++) {
  my $url = "http://rebrickable.com/search?q=sets&theme=0&numpieces=0&maxpieces=1050&year=1950&yearto=".$current_year."&official=1&pt=0&c=-1&sets=&v=3&p=".$i;
  my $webpage = get($url) or die 'Unable to get page';
  $tree->parse($webpage);
  my @anchor_nodes = $tree->findnodes('//*[@id="searchresults"]/a[@href]');
  my $pages_count_node = $tree->findvalue('//*[@id="pages"]/div[1]');
  if ($pages_count_node =~ /.*?(\d+?)$/) {
    $total_page_count = $1;
  }
  $total_page_count = $total_page_count + 0;
  if ($total_page_count == $i) {
	foreach (@anchor_nodes) {
	    if ($_->attr('href') =~ /^\/sets\/(.+?)\/(.+?)$/) {
	        my $rebrickable_lego_set_url_path = $_->attr('href');
	        my $lego_set_id = $1;
	        my $lego_set_title = $2;
	        $lego_set_id =~ s/^([^-]+?-[^-]+?)-[^-]+?$/$1/;
	        print $fh $lego_set_id.",".$lego_set_title.",http://rebrickable.com".$rebrickable_lego_set_url_path.",http://brickset.com/sets/".$lego_set_id.",http://www.brickpicker.com/bpms/set.cfm?set=".$lego_set_id."\n";
	    }
	 }
  }
}
print "completed\n";
$tree->delete;
close($fh);
