Name:           NHomeServer
Version:        1.00
Release:        auto
Summary:        NHomeServer
Group:          NHomeServer
License:        None
Requires:       nodejs npm

Source0:        %{name}.tar.gz

BuildRoot:      %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildArch:      noarch

URL:            http://nsoft.ba

%description
Home server for NHome

%prep

# Extract archive and enter directory
%setup -q -n %{name}

%build
# Nothing to do

%install
rm -rf %{buildroot}

mkdir -p %{buildroot}/opt/nhome
cp -pR * %{buildroot}/opt/nhome/

%clean
rm -rf %{buildroot}

%post

%preun

%files
%attr(0755,root,root) /opt/nhome

%changelog
